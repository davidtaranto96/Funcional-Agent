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

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Sesiones para el panel admin
app.use(session({
  secret: process.env.ADMIN_SESSION_SECRET || 'change-me-in-env',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

// Google OAuth — solo si está configurado
if (process.env.GOOGLE_CLIENT_ID) {
  const ALLOWED = (process.env.ADMIN_ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${(process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/admin/auth/google/callback`,
  }, (at, rt, profile, done) => {
    const email = (profile.emails?.[0]?.value || '').toLowerCase();
    if (ALLOWED.length === 0 || ALLOWED.includes(email)) {
      return done(null, { email, name: profile.displayName, photo: profile.photos?.[0]?.value });
    }
    return done(null, false);
  }));
  app.use(passport.initialize());
}

// Servir los demos estáticos (landing HTML, mockups PNG, PDFs)
app.use('/demos', express.static(path.join(__dirname, '..', 'data', 'demos')));

// Servir archivos de proyectos
app.use('/project-files', express.static(path.join(__dirname, '..', 'data', 'project-files')));

// Montar panel admin
app.use('/admin', adminRouter);

// Health check para Railway
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Webhook de verificación de Meta (GET) ────────────────────────────────
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('Webhook de Meta verificado OK');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ── Webhook principal de Meta (POST) ─────────────────────────────────────
app.post('/webhook', async (req, res) => {
  // Meta requiere 200 inmediato
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;

    // Ignorar notificaciones de estado (delivered, read, etc.)
    if (!change?.messages?.length) return;

    const msg = change.messages[0];
    const From = msg.from; // número sin "whatsapp:", ej: "5493877599185"
    const fromKey = `whatsapp:+${From}`; // formato interno consistente

    let text = '';

    // Texto normal
    if (msg.type === 'text') {
      text = msg.text?.body || '';
    }

    // Audio → transcribir con Whisper
    if (msg.type === 'audio') {
      const mediaId = msg.audio?.id;
      if (mediaId) {
        console.log(`Audio recibido de ${From}, transcribiendo...`);
        text = await transcribe(mediaId);
        console.log(`Transcripción: "${text}"`);
      }
    }

    // Ignorar stickers, imágenes sin texto, etc.
    if (!text.trim()) {
      await sendMessage(fromKey, 'Por ahora solo puedo leer texto y audios. ¿Me lo podés escribir?');
      return;
    }

    console.log(`Mensaje de ${fromKey}: "${text.substring(0, 100)}"`);

    // ── Comandos de admin desde el WhatsApp de David ──────────────────────
    // Argentina puede llegar como 5493878599185 (con 9) o 54387815599185 (con 15)
    // Normalizamos ambos: sacamos el 9 después de 54 y el 15 del celular
    const normalizeAR = (num) => {
      let n = num.replace(/\D/g, '');
      // 54 9 AREA LOCAL → 54AREALOCAL
      if (n.startsWith('549') && n.length === 13) n = '54' + n.slice(3);
      // 54 AREA 15 LOCAL → 54AREALOCAL
      n = n.replace(/^(54\d{3,4})15(\d{6,7})$/, '$1$2');
      return n;
    };
    const davidPhone = normalizeAR((process.env.DAVID_PHONE || '').replace('whatsapp:', '').replace('+', ''));
    if (normalizeAR(From) === davidPhone) {
      const cmd = text.trim().toUpperCase();
      const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

      if (cmd === 'PENDIENTES') {
        const pendientes = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review');
        if (pendientes.length === 0) {
          await sendMessage(fromKey, '✅ No hay demos pendientes de revisión.');
        } else {
          const lista = pendientes.map(c => {
            const nombre = c.report?.cliente?.nombre || c.phone;
            return `• *${nombre}*\n  ${appUrl}/admin/review/${encodeURIComponent(c.phone)}`;
          }).join('\n\n');
          await sendMessage(fromKey, `📋 *Demos pendientes (${pendientes.length}):*\n\n${lista}`);
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
          const pendientes = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review');
          if (pendientes.length === 0) {
            await sendMessage(fromKey, '⚠️ No hay demos pendientes para aprobar.');
            return;
          }
          targetPhone = pendientes[0].phone;
        }
        const conv = await db.getConversation(targetPhone);
        const nombre = conv?.report?.cliente?.nombre || targetPhone;
        await db.updateDemoStatus(targetPhone, 'approved');
        await db.appendTimelineEvent(targetPhone, { event: 'demo_approved', note: 'Aprobado desde WhatsApp' });
        orchestrator.sendApprovedDemoToClient(targetPhone).catch(console.error);
        await sendMessage(fromKey, `✅ *Aprobado.* Mandando demo a ${nombre}...`);
        return;
      }

      if (cmd.startsWith('RECHAZAR')) {
        const parts = text.trim().split(/\s+/);
        let targetPhone;
        if (parts.length > 1) {
          targetPhone = parts.slice(1).join('').trim();
          if (!targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:${targetPhone}`;
        } else {
          const pendientes = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review');
          if (pendientes.length === 0) {
            await sendMessage(fromKey, '⚠️ No hay demos pendientes.');
            return;
          }
          targetPhone = pendientes[0].phone;
        }
        await db.updateDemoStatus(targetPhone, 'rejected');
        await db.appendTimelineEvent(targetPhone, { event: 'demo_rejected', note: 'Rechazado desde WhatsApp' });
        await sendMessage(fromKey, `❌ Demo rechazado.`);
        return;
      }

      // STATUS +549... — ver estado completo de un cliente
      if (cmd.startsWith('STATUS')) {
        const parts = text.trim().split(/\s+/);
        let targetPhone = parts.length > 1 ? parts.slice(1).join('').trim() : null;
        if (targetPhone && !targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:+${targetPhone.replace(/[^0-9]/g,'')}`;
        const all = await db.listAllClients();
        if (!targetPhone) {
          const resumen = all.slice(-5).map(c => {
            const nombre = c.report?.cliente?.nombre || c.phone;
            return `• *${nombre}* — etapa: ${c.stage} | demo: ${c.demo_status}`;
          }).join('\n');
          await sendMessage(fromKey, `📊 *Últimos 5 clientes:*\n\n${resumen || 'Sin clientes aún.'}`);
        } else {
          const conv = await db.getConversation(targetPhone);
          if (!conv) { await sendMessage(fromKey, `❌ No encontré al cliente ${targetPhone}`); return; }
          const nombre = conv.report?.cliente?.nombre || targetPhone;
          const timeline = (conv.timeline || []).slice(-3).map(e => `• ${e.event}: ${e.note||''}`).join('\n');
          await sendMessage(fromKey,
            `📋 *${nombre}*\nEtapa: ${conv.stage}\nDemo: ${conv.demo_status}\nDrive: ${conv.drive_folder_id || 'sin carpeta'}\n\n*Últimos eventos:*\n${timeline || '(vacío)'}`);
        }
        return;
      }

      // REPORTE +549... — disparar flujo de demos manualmente para un cliente
      if (cmd.startsWith('REPORTE')) {
        const parts = text.trim().split(/\s+/);
        let targetPhone = parts.length > 1 ? parts.slice(1).join('').trim() : null;
        if (!targetPhone) { await sendMessage(fromKey, '⚠️ Usá: REPORTE +5493878599185'); return; }
        if (!targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:+${targetPhone.replace(/[^0-9]/g,'')}`;
        const conv = await db.getConversation(targetPhone);
        if (!conv?.report) { await sendMessage(fromKey, `❌ ${targetPhone} no tiene reporte todavía.`); return; }
        await sendMessage(fromKey, `🔄 Regenerando demos para ${conv.report?.cliente?.nombre || targetPhone}...`);
        orchestrator.processNewReport(targetPhone, conv.report).catch(console.error);
        return;
      }

      if (cmd === 'AYUDA' || cmd === 'HELP') {
        await sendMessage(fromKey,
          `*Comandos disponibles:*\n\n` +
          `• *PENDIENTES* — demos esperando aprobación\n` +
          `• *APROBAR* — aprobar demo más reciente\n` +
          `• *APROBAR +549...* — aprobar demo de número específico\n` +
          `• *RECHAZAR* — rechazar demo más reciente\n` +
          `• *STATUS* — últimos 5 clientes\n` +
          `• *STATUS +549...* — estado detallado de un cliente\n` +
          `• *REPORTE +549...* — regenerar demos manualmente\n\n` +
          `Panel web: ${appUrl}/admin`
        );
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    const result = await handleMessage(fromKey, text);

    // Si se acaba de confirmar el proyecto, generar y enviar reporte
    if (result.stage === 'done' && result.previousStage === 'confirming') {
      console.log(`[index] 🎯 Transición confirming→done para ${fromKey} — generando reporte...`);
      try {
        const conv = await db.getConversation(fromKey);
        const report = await generateReport(conv.history, fromKey);
        console.log(`[index] Reporte generado: ${report?.cliente?.nombre}`);

        await db.upsertConversation(fromKey, { report });

        // Notificar a David por WhatsApp
        const waReport = formatReportWhatsApp(report);
        try {
          await sendMessage(process.env.DAVID_PHONE, waReport);
          console.log(`[index] WhatsApp de reporte enviado a David`);
        } catch (e) { console.error('[index] Error WA reporte:', e.message); }

        // Notificar a David por email
        try {
          const htmlReport = formatReportEmail(report);
          await sendEmailReport(report, htmlReport);
          console.log(`[index] Email de reporte enviado`);
        } catch (e) { console.error('[index] Error email reporte:', e.message); }

        // Confirmar al cliente (puede fallar en sandbox con números no registrados — no es crítico)
        try {
          await sendMessage(fromKey,
            '🎨 ¡Perfecto! Ya le pasé todo a David. En los próximos minutos te mando una propuesta visual personalizada con lo que charlamos. ¡Fijate el WhatsApp!');
        } catch (e) {
          console.error('[index] No pude confirmar al cliente (sandbox?):', e.message);
        }

        // Arrancar generación de demos en background (siempre, independiente de errores anteriores)
        console.log(`[index] Lanzando orchestrator para ${fromKey}...`);
        orchestrator.processNewReport(fromKey, report).catch(err => {
          console.error('Error en orchestrator.processNewReport:', err);
          sendMessage(process.env.DAVID_PHONE,
            `⚠️ Error generando demos para ${fromKey}: ${err.message}`).catch(()=>{});
        });

      } catch (err) {
        console.error('Error generando/enviando reporte:', err);
        try {
          await sendMessage(process.env.DAVID_PHONE,
            `⚠️ Error generando reporte para ${fromKey}: ${err.message}`);
        } catch(e){}
      }
    }

    // Si hay una modificación post-reporte, notificar a David
    if (result.stage === 'done' && result.previousStage === 'done' && text) {
      const conv = await db.getConversation(fromKey);
      const nombre = conv?.report?.cliente?.nombre || fromKey;
      const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
      await sendMessage(process.env.DAVID_PHONE,
        `📝 *Cambio pedido por ${nombre}*\n📱 ${fromKey}\n\n"${text}"\n\n👉 ${appUrl}/admin/client/${encodeURIComponent(fromKey)}`);
      await db.appendTimelineEvent(fromKey, { event: 'client_requested_change', note: text.slice(0, 200) });
    }

    try {
      await sendMessage(fromKey, result.reply);
    } catch (e) {
      console.error('[index] Error enviando respuesta al cliente:', e.message);
    }

  } catch (err) {
    console.error('Error en webhook:', err);
  }
});

// Endpoint para setear contexto previo de un cliente
app.post('/context', async (req, res) => {
  const { phone, context } = req.body;

  if (!phone || !context) {
    return res.status(400).json({ error: 'Se requiere phone y context' });
  }

  // Normalizar formato del teléfono
  const normalizedPhone = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
  await db.setContext(normalizedPhone, context);

  res.json({ ok: true, phone: normalizedPhone });
});

// Resetear conversación de un cliente
app.post('/reset', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Se requiere phone' });

  const normalizedPhone = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
  await db.upsertConversation(normalizedPhone, {
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
    await db.setContext(normalizedPhone, context);
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
    const stale = await db.getStaleConversations(24);
    for (const conv of stale) {
      console.log(`Follow-up automático para ${conv.phone}`);
      await sendMessage(conv.phone,
        'Hola! Te escribo de nuevo de parte de David. ¿Pudiste pensar un poco más sobre el proyecto? Si tenés alguna duda o querés retomar la charla, acá estoy 😊');
      await db.markFollowupSent(conv.phone);
    }

    // 48hs después del follow-up (72hs total) → notificar a David
    const abandoned = await db.getAbandonedConversations(48);
    for (const conv of abandoned) {
      const nombre = conv.context?.nombre || conv.phone;
      console.log(`Cliente frío: ${conv.phone}`);
      await sendMessage(process.env.DAVID_PHONE,
        `❄️ *Cliente sin respuesta — ${nombre}*\n📱 ${conv.phone}\nNo respondió después de 72hs. Quizás quieras contactarlo directamente.`);
      await db.markAbandoned(conv.phone);
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
