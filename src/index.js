require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const { handleMessage } = require('./agent');
const { transcribe } = require('./transcriber');
const { sendMessage } = require('./whatsapp');
const { sendReport: sendEmailReport } = require('./mailer');
const { generateReport, formatReportWhatsApp, formatReportEmail } = require('./reports');
const db = require('./db');
const orchestrator = require('./orchestrator');
const adminRouter = require('./admin');

const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio manda form-encoded
app.use(express.json()); // Para el endpoint /context

// Sesiones para el panel admin
app.use(session({
  secret: process.env.ADMIN_SESSION_SECRET || 'change-me-in-env',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

// Servir los demos estáticos (landing HTML, mockups PNG, PDFs)
app.use('/demos', express.static(path.join(__dirname, '..', 'data', 'demos')));

// Montar panel admin
app.use('/admin', adminRouter);

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

    // ── Comandos de admin desde el WhatsApp de David ──────────────────────
    if (From === process.env.DAVID_PHONE) {
      const cmd = text.trim().toUpperCase();
      const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

      if (cmd === 'PENDIENTES') {
        const pendientes = db.listAllClients().filter(c => c.demo_status === 'pending_review');
        if (pendientes.length === 0) {
          await sendMessage(From, '✅ No hay demos pendientes de revisión.');
        } else {
          const lista = pendientes.map(c => {
            const nombre = c.report?.cliente?.nombre || c.phone;
            return `• *${nombre}*\n  ${appUrl}/admin/review/${encodeURIComponent(c.phone)}`;
          }).join('\n\n');
          await sendMessage(From, `📋 *Demos pendientes (${pendientes.length}):*\n\n${lista}`);
        }
        return;
      }

      if (cmd.startsWith('APROBAR')) {
        const parts = text.trim().split(/\s+/);
        let targetPhone;
        if (parts.length > 1) {
          targetPhone = parts.slice(1).join('').trim();
          if (!targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:${targetPhone}`;
        } else {
          const pendientes = db.listAllClients().filter(c => c.demo_status === 'pending_review');
          if (pendientes.length === 0) {
            await sendMessage(From, '⚠️ No hay demos pendientes para aprobar.');
            return;
          }
          targetPhone = pendientes[0].phone;
        }
        const conv = db.getConversation(targetPhone);
        const nombre = conv?.report?.cliente?.nombre || targetPhone;
        db.updateDemoStatus(targetPhone, 'approved');
        db.appendTimelineEvent(targetPhone, { event: 'demo_approved', note: 'Aprobado desde WhatsApp' });
        orchestrator.sendApprovedDemoToClient(targetPhone).catch(console.error);
        await sendMessage(From, `✅ *Aprobado.* Mandando demo a ${nombre}...`);
        return;
      }

      if (cmd.startsWith('RECHAZAR')) {
        const parts = text.trim().split(/\s+/);
        let targetPhone;
        if (parts.length > 1) {
          targetPhone = parts.slice(1).join('').trim();
          if (!targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:${targetPhone}`;
        } else {
          const pendientes = db.listAllClients().filter(c => c.demo_status === 'pending_review');
          if (pendientes.length === 0) {
            await sendMessage(From, '⚠️ No hay demos pendientes.');
            return;
          }
          targetPhone = pendientes[0].phone;
        }
        db.updateDemoStatus(targetPhone, 'rejected');
        db.appendTimelineEvent(targetPhone, { event: 'demo_rejected', note: 'Rechazado desde WhatsApp' });
        await sendMessage(From, `❌ Demo rechazado.`);
        return;
      }

      if (cmd === 'AYUDA' || cmd === 'HELP') {
        await sendMessage(From,
          `*Comandos disponibles:*\n\n` +
          `• *PENDIENTES* — ver demos que esperan tu aprobación\n` +
          `• *APROBAR* — aprobar el demo más reciente y mandárselo al cliente\n` +
          `• *APROBAR +549...* — aprobar demo de un número específico\n` +
          `• *RECHAZAR* — rechazar el demo más reciente\n` +
          `• *RECHAZAR +549...* — rechazar demo de un número específico\n\n` +
          `Panel web: ${appUrl}/admin`
        );
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    const result = await handleMessage(From, text);

    // Si se acaba de confirmar el proyecto, generar y enviar reporte
    if (result.stage === 'done' && result.previousStage === 'confirming') {
      try {
        const conv = db.getConversation(From);
        const report = await generateReport(conv.history, From);

        // Guardar reporte en la DB
        db.upsertConversation(From, { report });

        // Mandar reporte a David por WhatsApp (aviso rápido)
        const waReport = formatReportWhatsApp(report);
        await sendMessage(process.env.DAVID_PHONE, waReport);

        // Mandar reporte a David por email
        const htmlReport = formatReportEmail(report);
        await sendEmailReport(report, htmlReport);

        console.log(`Reporte enviado para ${From}`);

        // Notificar al cliente que viene una propuesta visual
        await sendMessage(From,
          '🎨 ¡Perfecto! Ya le pasé todo a David. En los próximos minutos te mando una propuesta visual personalizada con lo que charlamos. ¡Fijate el WhatsApp!');

        // Disparar en background la generación de demos + notificación de review
        orchestrator.processNewReport(From, report).catch(err =>
          console.error('Error en orchestrator.processNewReport:', err));
      } catch (err) {
        console.error('Error generando/enviando reporte:', err);
        await sendMessage(process.env.DAVID_PHONE,
          `⚠️ Error generando reporte para ${From}: ${err.message}`);
      }
    }

    // Si hay una modificación post-reporte, notificar a David con contexto completo
    if (result.stage === 'done' && result.previousStage === 'done' && text) {
      const conv = db.getConversation(From);
      const nombre = conv?.report?.cliente?.nombre || From;
      const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
      await sendMessage(process.env.DAVID_PHONE,
        `📝 *Cambio pedido por ${nombre}*\n📱 ${From}\n\n"${text}"\n\n👉 ${appUrl}/admin/client/${encodeURIComponent(From)}`);
      db.appendTimelineEvent(From, { event: 'client_requested_change', note: text.slice(0, 200) });
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

// Resetear conversación de un cliente
app.post('/reset', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Se requiere phone' });

  const normalizedPhone = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
  db.upsertConversation(normalizedPhone, {
    history: [],
    stage: 'greeting',
    context: {},
    report: null,
  });

  res.json({ ok: true, phone: normalizedPhone, message: 'Conversación reiniciada' });
});

// Mensaje proactivo: David dispara el primer contacto al cliente
app.post('/start', async (req, res) => {
  const { phone, context } = req.body;
  if (!phone) return res.status(400).json({ error: 'Se requiere phone' });

  const normalizedPhone = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;

  // Guardar contexto si viene
  if (context) {
    db.setContext(normalizedPhone, context);
  }

  try {
    // Generar saludo inicial del agente
    const result = await handleMessage(normalizedPhone, '[El cliente fue contactado proactivamente por David]');
    await sendMessage(normalizedPhone, result.reply);
    res.json({ ok: true, phone: normalizedPhone, message: result.reply });
  } catch (err) {
    console.error('Error en /start:', err);
    res.status(500).json({ error: err.message });
  }
});

// Follow-up automático para conversaciones sin respuesta
async function checkStaleConversations() {
  try {
    // 24hs sin respuesta → mensaje de seguimiento al cliente
    const stale = db.getStaleConversations(24);
    for (const conv of stale) {
      console.log(`Follow-up automático para ${conv.phone}`);
      await sendMessage(conv.phone,
        'Hola! Te escribo de nuevo de parte de David. ¿Pudiste pensar un poco más sobre el proyecto? Si tenés alguna duda o querés retomar la charla, acá estoy 😊');
      db.markFollowupSent(conv.phone);
    }

    // 48hs después del follow-up (72hs total) → notificar a David
    const abandoned = db.getAbandonedConversations(48);
    for (const conv of abandoned) {
      const nombre = conv.context?.nombre || conv.phone;
      console.log(`Cliente frío: ${conv.phone}`);
      await sendMessage(process.env.DAVID_PHONE,
        `❄️ *Cliente sin respuesta — ${nombre}*\n📱 ${conv.phone}\nNo respondió después de 72hs. Quizás quieras contactarlo directamente.`);
      db.markAbandoned(conv.phone);
    }
  } catch (err) {
    console.error('Error en follow-up check:', err);
  }
}

// Inicializar DB y arrancar servidor
const PORT = process.env.PORT || 3000;

db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`WPanalista corriendo en puerto ${PORT}`);
    console.log(`Webhook: POST /webhook`);
    console.log(`Contexto: POST /context`);
  });

  // Chequear conversaciones sin respuesta cada hora
  setInterval(checkStaleConversations, 60 * 60 * 1000);
  console.log('Follow-up checker activo (cada 1 hora)');
}).catch(err => {
  console.error('Error inicializando la base de datos:', err);
  process.exit(1);
});
