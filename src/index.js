require('dotenv').config();

// ── Safety net: evitar que errores no capturados maten el proceso ─────────────
process.on('unhandledRejection', (reason) => {
  console.error('[SAFETY] Unhandled Promise Rejection — el proceso NO se va a caer:', reason?.message || reason);
  if (reason?.stack) console.error(reason.stack);
});

process.on('uncaughtException', (err) => {
  console.error('[SAFETY] Uncaught Exception — el proceso NO se va a caer:', err.message);
  if (err.stack) console.error(err.stack);
});
// ─────────────────────────────────────────────────────────────────────────────

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
const calendar = require('./calendar');
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

// Diagnóstico de config (sin revelar valores)
app.get('/webhook/debug', (req, res) => {
  const check = (v) => process.env[v] ? '✅' : '❌ FALTA';
  res.json({
    version: '2.0.0',
    env: {
      TWILIO_ACCOUNT_SID: check('TWILIO_ACCOUNT_SID'),
      TWILIO_AUTH_TOKEN: check('TWILIO_AUTH_TOKEN'),
      TWILIO_WHATSAPP_NUMBER: check('TWILIO_WHATSAPP_NUMBER'),
      ANTHROPIC_API_KEY: check('ANTHROPIC_API_KEY'),
      DAVID_PHONE: check('DAVID_PHONE'),
      GOOGLE_REFRESH_TOKEN: check('GOOGLE_REFRESH_TOKEN'),
    },
  });
});

// ── Helper TwiML: responde inline a Twilio ──────────────────────────────────
function twimlReply(res, text) {
  if (res.headersSent) return;
  res.set('Content-Type', 'text/xml');
  if (!text) return res.send('<Response/>');
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  res.send(`<Response><Message>${safe}</Message></Response>`);
}

// ── Webhook de Twilio (POST) ──────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  try {
    const From = req.body?.From || '';
    const Body = req.body?.Body || '';
    const NumMedia = parseInt(req.body?.NumMedia || '0');
    const MediaUrl0 = req.body?.MediaUrl0;
    const MediaType0 = req.body?.MediaContentType0 || '';

    console.log(`[webhook] From=${From} Body="${(Body || '').substring(0, 80)}" NumMedia=${NumMedia}`);

    if (!From) return twimlReply(res);

    const fromKey = From.startsWith('whatsapp:') ? From : `whatsapp:${From}`;
    let text = Body.trim();

    // Audio → transcribir con Whisper
    if (NumMedia > 0 && MediaUrl0 && MediaType0.startsWith('audio/')) {
      console.log(`[webhook] Audio recibido, transcribiendo...`);
      text = (await transcribe(MediaUrl0)) || '';
      console.log(`[webhook] Transcripción: "${text}"`);
    }

    if (!text.trim()) {
      return twimlReply(res, 'Por ahora solo puedo leer texto y audios. ¿Me lo podés escribir?');
    }

    console.log(`[webhook] Procesando mensaje de ${fromKey}: "${text.substring(0, 100)}"`);

    // ── Comandos de admin desde el WhatsApp de David ──────────────────────
    const normalizeAR = (num) => {
      let n = num.replace(/\D/g, '');
      if (n.startsWith('549') && n.length === 13) n = '54' + n.slice(3);
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
          return twimlReply(res, '✅ No hay demos pendientes de revisión.');
        }
        const lista = pendientes.map(c => {
          const nombre = c.report?.cliente?.nombre || c.phone;
          return `• ${nombre}\n  ${appUrl}/admin/review/${encodeURIComponent(c.phone)}`;
        }).join('\n\n');
        return twimlReply(res, `📋 Demos pendientes (${pendientes.length}):\n\n${lista}`);
      }

      if (cmd.startsWith('APROBAR')) {
        const parts = text.trim().split(/\s+/);
        let targetPhone;
        if (parts.length > 1) {
          targetPhone = parts.slice(1).join('').trim();
          if (!targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:${targetPhone}`;
        } else {
          const pendientes = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review');
          if (pendientes.length === 0) return twimlReply(res, '⚠️ No hay demos pendientes para aprobar.');
          targetPhone = pendientes[0].phone;
        }
        const conv = await db.getConversation(targetPhone);
        const nombre = conv?.report?.cliente?.nombre || targetPhone;
        await db.updateDemoStatus(targetPhone, 'approved');
        await db.appendTimelineEvent(targetPhone, { event: 'demo_approved', note: 'Aprobado desde WhatsApp' });
        orchestrator.sendApprovedDemoToClient(targetPhone).catch(console.error);
        return twimlReply(res, `✅ Aprobado. Mandando demo a ${nombre}...`);
      }

      if (cmd.startsWith('RECHAZAR')) {
        const parts = text.trim().split(/\s+/);
        let targetPhone;
        if (parts.length > 1) {
          targetPhone = parts.slice(1).join('').trim();
          if (!targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:${targetPhone}`;
        } else {
          const pendientes = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review');
          if (pendientes.length === 0) return twimlReply(res, '⚠️ No hay demos pendientes.');
          targetPhone = pendientes[0].phone;
        }
        await db.updateDemoStatus(targetPhone, 'rejected');
        await db.appendTimelineEvent(targetPhone, { event: 'demo_rejected', note: 'Rechazado desde WhatsApp' });
        return twimlReply(res, '❌ Demo rechazado.');
      }

      if (cmd.startsWith('STATUS')) {
        const parts = text.trim().split(/\s+/);
        let targetPhone = parts.length > 1 ? parts.slice(1).join('').trim() : null;
        if (targetPhone && !targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:+${targetPhone.replace(/[^0-9]/g,'')}`;
        const all = await db.listAllClients();
        if (!targetPhone) {
          const resumen = all.slice(-5).map(c => {
            const nombre = c.report?.cliente?.nombre || c.phone;
            return `• ${nombre} — etapa: ${c.stage} | demo: ${c.demo_status}`;
          }).join('\n');
          return twimlReply(res, `📊 Últimos 5 clientes:\n\n${resumen || 'Sin clientes aún.'}`);
        }
        const conv = await db.getConversation(targetPhone);
        if (!conv) return twimlReply(res, `❌ No encontré al cliente ${targetPhone}`);
        const nombre = conv.report?.cliente?.nombre || targetPhone;
        const timeline = (conv.timeline || []).slice(-3).map(e => `• ${e.event}: ${e.note||''}`).join('\n');
        return twimlReply(res, `📋 ${nombre}\nEtapa: ${conv.stage}\nDemo: ${conv.demo_status}\n\nÚltimos eventos:\n${timeline || '(vacío)'}`);
      }

      if (cmd.startsWith('REPORTE')) {
        const parts = text.trim().split(/\s+/);
        let targetPhone = parts.length > 1 ? parts.slice(1).join('').trim() : null;
        if (!targetPhone) return twimlReply(res, '⚠️ Usá: REPORTE +5493878599185');
        if (!targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:+${targetPhone.replace(/[^0-9]/g,'')}`;
        const conv = await db.getConversation(targetPhone);
        if (!conv?.report) return twimlReply(res, `❌ ${targetPhone} no tiene reporte todavía.`);
        twimlReply(res, `🔄 Regenerando demos para ${conv.report?.cliente?.nombre || targetPhone}...`);
        orchestrator.processNewReport(targetPhone, conv.report).catch(console.error);
        return;
      }

      if (cmd === 'AYUDA' || cmd === 'HELP') {
        return twimlReply(res,
          `Comandos disponibles:\n\n` +
          `• PENDIENTES — demos esperando aprobación\n` +
          `• APROBAR — aprobar demo más reciente\n` +
          `• APROBAR +549... — aprobar de número específico\n` +
          `• RECHAZAR — rechazar demo más reciente\n` +
          `• STATUS — últimos 5 clientes\n` +
          `• STATUS +549... — estado de un cliente\n` +
          `• REPORTE +549... — regenerar demos\n\n` +
          `Panel web: ${appUrl}/admin`
        );
      }

      // Si David manda algo que no es comando, cae al flujo normal ↓
    }
    // ─────────────────────────────────────────────────────────────────────

    // ── Flujo normal: procesar con el agente de Claude ────────────────────
    const result = await handleMessage(fromKey, text);

    // ── Flujo de reunión (modifica result.reply antes de enviar) ──────────
    if (result.needsCalendarSlots) {
      try {
        const calSlots = await calendar.getAvailableSlots();
        if (calSlots.length > 0) {
          const conv = await db.getConversation(fromKey);
          const slotsData = calSlots.map(s => ({ start: s.start.toISOString(), end: s.end.toISOString() }));
          await db.upsertConversation(fromKey, { context: { ...(conv?.context || {}), pendingSlots: slotsData } });
          const slotsText = calendar.formatSlotsForWhatsApp(calSlots);
          result.reply += `\n\nTe dejo 3 opciones para que elijas la que más te queda:\n\n${slotsText}\n\n¿Cuál te viene mejor?`;
          await db.appendTimelineEvent(fromKey, { event: 'calendar_slots_shown', note: '3 horarios mostrados' });
        } else {
          result.reply += '\n\n(Esta semana David anda un poco justo de horarios, te va a escribir directamente para coordinar)';
        }
      } catch (err) {
        console.error('[calendar] Error buscando horarios:', err.message);
      }
    }

    if (result.selectedSlotIndex !== null) {
      try {
        const conv = await db.getConversation(fromKey);
        const slotsData = conv?.context?.pendingSlots || [];
        if (slotsData.length > result.selectedSlotIndex) {
          const sd = slotsData[result.selectedSlotIndex];
          const slot = { start: new Date(sd.start), end: new Date(sd.end) };
          const clientName = conv?.report?.cliente?.nombre || 'Cliente';
          const clientEmail = conv?.report?.cliente?.email || null;
          const { meetLink } = await calendar.createMeetingEvent(slot, clientName, clientEmail);
          const slotLabel = calendar.formatSlotsForWhatsApp([slot]).replace(/^\*\d+\.\* /, '');
          const meetPart = meetLink ? `\n\nLink de la videollamada: ${meetLink}` : '';
          result.reply += `\n\n📅 Agendado para el ${slotLabel}${meetPart}\n\nDavid te confirma por acá también.`;
          await db.updateClientStage(fromKey, 'negotiating');
          await db.appendTimelineEvent(fromKey, { event: 'meeting_scheduled', note: `${slotLabel}${meetLink ? ' — ' + meetLink : ''}` });
          // Notificar a David in-app
          db.addNotification({ type: 'meeting', title: `Reunión agendada con ${clientName}`, body: `${slotLabel}${meetLink ? ' — ' + meetLink : ''}`, phone: fromKey }).catch(e => console.error('[calendar] Notif:', e.message));
        }
      } catch (err) {
        console.error('[calendar] Error creando evento:', err.message);
        result.reply += '\n\n(Voy a coordinar el horario con David, en un rato te confirman)';
      }
    }

    // ── Enviar respuesta al cliente via TwiML (confiable, sin REST API) ──
    console.log(`[webhook] Respondiendo: "${result.reply.substring(0, 120)}..."`);
    twimlReply(res, result.reply);

    // ── Trabajo pesado en background (notificaciones, reportes, demos) ───
    // Esto corre DESPUÉS de enviar el TwiML, no bloquea al cliente

    if (result.stage === 'done' && result.previousStage === 'confirming') {
      (async () => {
        try {
          console.log(`[bg] Transición confirming→done para ${fromKey} — generando reporte...`);
          const conv = await db.getConversation(fromKey);
          const report = await generateReport(conv.history, fromKey);
          console.log(`[bg] Reporte generado: ${report?.cliente?.nombre}`);
          await db.upsertConversation(fromKey, { report });
          const nombre = report?.cliente?.nombre || fromKey;

          // Notificación in-app (no WhatsApp)
          await db.addNotification({ type: 'lead', title: `Nuevo reporte: ${nombre}`, body: `${report?.proyecto?.tipo || 'Proyecto'} — listo para generar demos`, phone: fromKey });

          // Email sí se manda (no es spam, es útil)
          try { const html = formatReportEmail(report); await sendEmailReport(report, html); } catch (e) { console.error('[bg] Email:', e.message); }

          // Confirmar al cliente via REST API (mensaje adicional post-TwiML)
          try { await sendMessage(fromKey, '🎨 ¡Perfecto! Ya le pasé todo a David. En unos minutos te mando una propuesta visual por acá mismo.'); } catch (e) { console.error('[bg] Confirm client:', e.message); }

          console.log(`[bg] Lanzando orchestrator para ${fromKey}...`);
          orchestrator.processNewReport(fromKey, report).catch(err => {
            console.error('[bg] orchestrator error:', err);
            db.addNotification({ type: 'warning', title: `Error generando demos`, body: err.message, phone: fromKey }).catch(() => {});
          });
        } catch (err) {
          console.error('[bg] Error generando reporte:', err);
          db.addNotification({ type: 'warning', title: 'Error generando reporte', body: err.message, phone: fromKey }).catch(() => {});
        }
      })();
    }

    if (result.stage === 'done' && result.previousStage === 'done' && text) {
      (async () => {
        try {
          const conv = await db.getConversation(fromKey);
          const nombre = conv?.report?.cliente?.nombre || fromKey;
          await db.addNotification({ type: 'info', title: `${nombre} pidió un cambio`, body: text.slice(0, 200), phone: fromKey });
          await db.appendTimelineEvent(fromKey, { event: 'client_requested_change', note: text.slice(0, 200) });
        } catch (e) { console.error('[bg] Notify mod:', e.message); }
      })();
    }

    if (result.wantsChanges) {
      (async () => {
        try {
          const conv = await db.getConversation(fromKey);
          const nombre = conv?.report?.cliente?.nombre || fromKey;
          await db.addNotification({ type: 'demo', title: `${nombre} quiere ajustes en la propuesta`, body: text.slice(0, 200), phone: fromKey });
          await db.appendTimelineEvent(fromKey, { event: 'client_wants_changes', note: text.slice(0, 200) });
        } catch (e) { console.error('[bg] Notify changes:', e.message); }
      })();
    }

  } catch (err) {
    console.error('[webhook] Error fatal:', err);
    if (!res.headersSent) {
      twimlReply(res, 'Perdón, tuve un error. ¿Podés intentar de nuevo?');
    }
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
