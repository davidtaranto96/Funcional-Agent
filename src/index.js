require('dotenv').config();

const express = require('express');
const { handleMessage } = require('./agent');
const { transcribe } = require('./transcriber');
const { sendMessage } = require('./whatsapp');
const { sendReport: sendEmailReport } = require('./mailer');
const { generateReport, formatReportWhatsApp, formatReportEmail } = require('./reports');
const db = require('./db');

const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio manda form-encoded
app.use(express.json()); // Para el endpoint /context

// Health check para Railway
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook principal de Twilio
app.post('/webhook', async (req, res) => {
  // Responder inmediatamente para evitar timeout de 15s de Twilio
  res.type('text/xml').send('<Response/>');

  try {
    const { From, Body, NumMedia, MediaUrl0, MediaContentType0 } = req.body;
    let text = Body || '';

    // Si mandaron audio, transcribir con Whisper
    if (parseInt(NumMedia) > 0 && MediaContentType0?.startsWith('audio/')) {
      console.log(`Audio recibido de ${From}, transcribiendo...`);
      text = await transcribe(MediaUrl0);
      console.log(`Transcripción: "${text}"`);
    }

    // Ignorar mensajes vacíos (stickers, imágenes sin texto, etc.)
    if (!text.trim()) {
      await sendMessage(From, 'Por ahora solo puedo leer texto y audios. ¿Me lo podés escribir?');
      return;
    }

    console.log(`Mensaje de ${From}: "${text.substring(0, 100)}..."`);

    const result = await handleMessage(From, text);

    // Si se acaba de confirmar el proyecto, generar y enviar reporte
    if (result.stage === 'done' && result.previousStage === 'confirming') {
      try {
        const conv = db.getConversation(From);
        const report = await generateReport(conv.history, From);

        // Guardar reporte en la DB
        db.upsertConversation(From, { report });

        // Mandar reporte a David por WhatsApp
        const waReport = formatReportWhatsApp(report);
        await sendMessage(process.env.DAVID_PHONE, waReport);

        // Mandar reporte a David por email
        const htmlReport = formatReportEmail(report);
        await sendEmailReport(report, htmlReport);

        console.log(`Reporte enviado para ${From}`);
      } catch (err) {
        console.error('Error generando/enviando reporte:', err);
        await sendMessage(process.env.DAVID_PHONE,
          `⚠️ Error generando reporte para ${From}: ${err.message}`);
      }
    }

    // Si hay una modificación post-reporte, notificar a David
    if (result.stage === 'done' && result.previousStage === 'done' && text) {
      await sendMessage(process.env.DAVID_PHONE,
        `📝 *Modificación de ${From}:*\n${text}`);
    }

    // Enviar respuesta al cliente
    await sendMessage(From, result.reply);

  } catch (err) {
    console.error('Error en webhook:', err);
    try {
      await sendMessage(req.body.From,
        'Perdón, tuve un problema técnico. ¿Podés repetir lo que me dijiste?');
    } catch (sendErr) {
      console.error('Error enviando mensaje de error:', sendErr);
    }
  }
});

// Endpoint para setear contexto previo de un cliente
app.post('/context', (req, res) => {
  const { phone, context } = req.body;

  if (!phone || !context) {
    return res.status(400).json({ error: 'Se requiere phone y context' });
  }

  // Normalizar formato del teléfono
  const normalizedPhone = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
  db.setContext(normalizedPhone, context);

  res.json({ ok: true, phone: normalizedPhone });
});

// Inicializar DB y arrancar servidor
const PORT = process.env.PORT || 3000;

db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`WPanalista corriendo en puerto ${PORT}`);
    console.log(`Webhook: POST /webhook`);
    console.log(`Contexto: POST /context`);
  });
}).catch(err => {
  console.error('Error inicializando la base de datos:', err);
  process.exit(1);
});
