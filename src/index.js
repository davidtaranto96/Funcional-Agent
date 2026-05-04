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
const { sendMessage, startWhatsApp, getStatus: getWhatsAppStatus } = require('./whatsapp');
const { sendReport: sendEmailReport } = require('./mailer');
const { generateReport, formatReportEmail } = require('./reports');
const db = require('./db');
const orchestrator = require('./orchestrator');
const calendar = require('./calendar');
const adminRouter = require('./admin');
const fileApiRouter = require('./file-api');

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Fail closed si falta el secret en producción
if (!process.env.ADMIN_SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: ADMIN_SESSION_SECRET is required in production');
  }
  console.warn('[WARN] ADMIN_SESSION_SECRET no seteado — generando secret efímero (sesiones se invalidan al reiniciar)');
}
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || require('crypto').randomBytes(32).toString('hex');
const IS_PROD = process.env.NODE_ENV === 'production';

function requireAdminToken(req, res, next) {
  const token = req.get('x-admin-token') || req.query.admin_token;
  if (!process.env.ADMIN_API_TOKEN || token !== process.env.ADMIN_API_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

const app = express();
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

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

app.use('/demos', express.static(path.join(__dirname, '..', 'data', 'demos')));
app.use('/project-files', express.static(path.join(__dirname, '..', 'data', 'project-files')));
app.use('/admin', adminRouter);

// File API: endpoints REST para que Next.js pueda gestionar archivos del volume
// (Next.js corre en otro Railway service sin acceso al volume).
// Auth: header 'x-admin-token' con ADMIN_API_TOKEN.
app.use('/api', fileApiRouter);

app.get('/health', (req, res) => {
  const wa = getWhatsAppStatus();
  res.json({ status: 'ok', timestamp: new Date().toISOString(), whatsapp: wa });
});

// Diagnóstico de config
app.get('/webhook/debug', requireAdminToken, (req, res) => {
  const check = (v) => process.env[v] ? '✅' : '❌ FALTA';
  res.json({
    version: '3.0.0-baileys',
    env: {
      ANTHROPIC_API_KEY: check('ANTHROPIC_API_KEY'),
      GROQ_API_KEY: check('GROQ_API_KEY'),
      DAVID_PHONE: check('DAVID_PHONE'),
      GOOGLE_REFRESH_TOKEN: check('GOOGLE_REFRESH_TOKEN'),
    },
    whatsapp: getWhatsAppStatus(),
    note: 'Twilio fue removido. WhatsApp ahora corre con Baileys (nativo).',
  });
});

// Diagnóstico: muestra últimos mensajes recibidos
const lastMessages = [];
app.get('/webhook/last', requireAdminToken, (req, res) => {
  res.json(lastMessages);
});

// Test de Groq
app.get('/webhook/test-groq', requireAdminToken, async (req, res) => {
  try {
    const Groq = require('groq-sdk');
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.json({ error: 'GROQ_API_KEY no configurada' });
    const client = new Groq({ apiKey });
    const models = await client.models.list();
    const whisper = models.data?.find(m => m.id?.includes('whisper'));
    res.json({ ok: true, groq_connected: true, whisper_available: !!whisper, whisper_model: whisper?.id || 'no encontrado' });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// ── Helper: comandos admin desde el WhatsApp de David ────────────────────────
async function handleAdminCommand(fromKey, text) {
  const normalizeAR = (num) => {
    let n = num.replace(/\D/g, '');
    if (n.startsWith('549') && n.length === 13) n = '54' + n.slice(3);
    n = n.replace(/^(54\d{3,4})15(\d{6,7})$/, '$1$2');
    return n;
  };
  const davidPhone = normalizeAR((process.env.DAVID_PHONE || '').replace('whatsapp:', '').replace('+', ''));
  if (normalizeAR(fromKey) !== davidPhone) return null;

  const cmd = text.trim().toUpperCase();
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  if (cmd === 'PENDIENTES') {
    const pendientes = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review');
    if (pendientes.length === 0) return '✅ No hay demos pendientes de revisión.';
    const lista = pendientes.map(c => {
      const nombre = c.report?.cliente?.nombre || c.phone;
      return `• ${nombre}\n  ${appUrl}/admin/review/${encodeURIComponent(c.phone)}`;
    }).join('\n\n');
    return `📋 Demos pendientes (${pendientes.length}):\n\n${lista}`;
  }

  if (cmd.startsWith('APROBAR')) {
    const parts = text.trim().split(/\s+/);
    let targetPhone;
    if (parts.length > 1) {
      targetPhone = parts.slice(1).join('').trim();
      if (!targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:${targetPhone}`;
    } else {
      const pendientes = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review');
      if (pendientes.length === 0) return '⚠️ No hay demos pendientes para aprobar.';
      targetPhone = pendientes[0].phone;
    }
    const conv = await db.getConversation(targetPhone);
    const nombre = conv?.report?.cliente?.nombre || targetPhone;
    await db.updateDemoStatus(targetPhone, 'approved');
    await db.appendTimelineEvent(targetPhone, { event: 'demo_approved', note: 'Aprobado desde WhatsApp' });
    orchestrator.sendApprovedDemoToClient(targetPhone).catch(console.error);
    return `✅ Aprobado. Mandando demo a ${nombre}...`;
  }

  if (cmd.startsWith('RECHAZAR')) {
    const parts = text.trim().split(/\s+/);
    let targetPhone;
    if (parts.length > 1) {
      targetPhone = parts.slice(1).join('').trim();
      if (!targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:${targetPhone}`;
    } else {
      const pendientes = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review');
      if (pendientes.length === 0) return '⚠️ No hay demos pendientes.';
      targetPhone = pendientes[0].phone;
    }
    await db.updateDemoStatus(targetPhone, 'rejected');
    await db.appendTimelineEvent(targetPhone, { event: 'demo_rejected', note: 'Rechazado desde WhatsApp' });
    return '❌ Demo rechazado.';
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
      return `📊 Últimos 5 clientes:\n\n${resumen || 'Sin clientes aún.'}`;
    }
    const conv = await db.getConversation(targetPhone);
    if (!conv) return `❌ No encontré al cliente ${targetPhone}`;
    const nombre = conv.report?.cliente?.nombre || targetPhone;
    const timeline = (conv.timeline || []).slice(-3).map(e => `• ${e.event}: ${e.note||''}`).join('\n');
    return `📋 ${nombre}\nEtapa: ${conv.stage}\nDemo: ${conv.demo_status}\n\nÚltimos eventos:\n${timeline || '(vacío)'}`;
  }

  if (cmd.startsWith('REPORTE')) {
    const parts = text.trim().split(/\s+/);
    let targetPhone = parts.length > 1 ? parts.slice(1).join('').trim() : null;
    if (!targetPhone) return '⚠️ Usá: REPORTE +5493878599185';
    if (!targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:+${targetPhone.replace(/[^0-9]/g,'')}`;
    const conv = await db.getConversation(targetPhone);
    if (!conv?.report) return `❌ ${targetPhone} no tiene reporte todavía.`;
    orchestrator.processNewReport(targetPhone, conv.report).catch(console.error);
    return `🔄 Regenerando demos para ${conv.report?.cliente?.nombre || targetPhone}...`;
  }

  if (cmd === 'AYUDA' || cmd === 'HELP') {
    return `Comandos:\n• PENDIENTES\n• APROBAR [+549...]\n• RECHAZAR [+549...]\n• STATUS [+549...]\n• REPORTE +549...\n\nPanel: ${appUrl}/admin`;
  }

  return null; // No es comando, sigue al flujo normal
}

// ── Procesador principal de mensajes entrantes ───────────────────────────────
// Reemplaza al webhook handler de Twilio.
async function processIncomingMessage({ fromKey, text, audioBuffer, audioMime, hasMedia }) {
  // Log para diagnóstico
  lastMessages.unshift({
    time: new Date().toISOString(),
    from: fromKey,
    text: (text || '').substring(0, 100),
    hasAudio: !!audioBuffer,
    hasMedia,
  });
  if (lastMessages.length > 10) lastMessages.length = 10;

  console.log(`[wa] From=${fromKey} text="${(text || '').substring(0, 80)}" audio=${!!audioBuffer} media=${hasMedia}`);

  let actualText = (text || '').trim();

  // Audio → transcribir
  if (audioBuffer) {
    // Aviso de recibo (Baileys soporta typing/sending indicator pero un mensaje rápido es más claro)
    sendMessage(fromKey, '🎙️ Recibí tu audio, dame unos segundos que lo proceso...').catch(() => {});
    try {
      const transcribed = await transcribe(audioBuffer, { mime: audioMime });
      if (!transcribed || transcribed.startsWith('[')) {
        await sendMessage(fromKey, transcribed || 'No pude entender el audio. ¿Podrías escribirlo o grabar otro?');
        return;
      }
      actualText = transcribed;
    } catch (err) {
      console.error('[wa] Error transcribiendo:', err.message);
      await sendMessage(fromKey, 'Perdón, tuve un error procesando el audio. ¿Podés escribirlo o grabar otro?');
      return;
    }
  }

  // Otros media sin texto
  if (!actualText && hasMedia) {
    await sendMessage(fromKey, 'Por ahora solo puedo leer texto y audios. Si me querés mandar algo, escribilo o grabá un audio.');
    return;
  }
  if (!actualText) return;

  // Comandos admin de David
  const adminReply = await handleAdminCommand(fromKey, actualText);
  if (adminReply) {
    await sendMessage(fromKey, adminReply);
    return;
  }

  // Flujo normal: agente Claude
  let result;
  try {
    result = await handleMessage(fromKey, actualText);
  } catch (err) {
    console.error('[wa] Error en agente:', err);
    await sendMessage(fromKey, 'Perdón, tuve un error. ¿Podés intentar de nuevo?');
    return;
  }

  // Calendario: generar slots si el agente lo pidió
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
    } catch (err) { console.error('[calendar] Error buscando horarios:', err.message); }
  }

  // Calendario: confirmar slot elegido
  if (result.selectedSlotIndex !== null && result.selectedSlotIndex !== undefined) {
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
        db.addNotification({ type: 'meeting', title: `Reunión agendada con ${clientName}`, body: `${slotLabel}${meetLink ? ' — ' + meetLink : ''}`, phone: fromKey }).catch(e => console.error('[calendar] Notif:', e.message));
      }
    } catch (err) {
      console.error('[calendar] Error creando evento:', err.message);
      result.reply += '\n\n(Voy a coordinar el horario con David, en un rato te confirman)';
    }
  }

  // Enviar respuesta del agente
  console.log(`[wa] → ${fromKey}: "${result.reply.substring(0, 120)}..."`);
  await sendMessage(fromKey, result.reply);

  // Background work: reportes / notificaciones / orchestrator
  if (result.stage === 'done' && result.previousStage === 'confirming') {
    (async () => {
      try {
        console.log(`[bg] Transición confirming→done para ${fromKey} — generando reporte...`);
        const conv = await db.getConversation(fromKey);
        const report = await generateReport(conv.history, fromKey);
        console.log(`[bg] Reporte generado: ${report?.cliente?.nombre}`);
        await db.upsertConversation(fromKey, { report });
        const nombre = report?.cliente?.nombre || fromKey;
        await db.addNotification({ type: 'lead', title: `Nuevo reporte: ${nombre}`, body: `${report?.proyecto?.tipo || 'Proyecto'} — listo para generar demos`, phone: fromKey });
        try { const html = formatReportEmail(report); await sendEmailReport(report, html); } catch (e) { console.error('[bg] Email:', e.message); }
        try { await sendMessage(fromKey, '🎨 ¡Perfecto! Ya le pasé todo a David. En unos minutos te mando una propuesta visual por acá mismo.'); } catch (e) { console.error('[bg] Confirm client:', e.message); }
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

  if (result.stage === 'done' && result.previousStage === 'done' && actualText) {
    (async () => {
      try {
        const conv = await db.getConversation(fromKey);
        const nombre = conv?.report?.cliente?.nombre || fromKey;
        await db.addNotification({ type: 'info', title: `${nombre} pidió un cambio`, body: actualText.slice(0, 200), phone: fromKey });
        await db.appendTimelineEvent(fromKey, { event: 'client_requested_change', note: actualText.slice(0, 200) });
      } catch (e) { console.error('[bg] Notify mod:', e.message); }
    })();
  }

  if (result.wantsChanges) {
    (async () => {
      try {
        const conv = await db.getConversation(fromKey);
        const nombre = conv?.report?.cliente?.nombre || fromKey;
        await db.addNotification({ type: 'demo', title: `${nombre} quiere ajustes en la propuesta`, body: actualText.slice(0, 200), phone: fromKey });
        await db.appendTimelineEvent(fromKey, { event: 'client_wants_changes', note: actualText.slice(0, 200) });
      } catch (e) { console.error('[bg] Notify changes:', e.message); }
    })();
  }
}

// ── Endpoints administrativos vía API REST ───────────────────────────────────

app.post('/context', requireAdminToken, async (req, res) => {
  const { phone, context } = req.body;
  if (!phone || !context) return res.status(400).json({ error: 'Se requiere phone y context' });
  const normalizedPhone = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
  await db.setContext(normalizedPhone, context);
  res.json({ ok: true, phone: normalizedPhone });
});

app.post('/reset', requireAdminToken, async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Se requiere phone' });
  const normalizedPhone = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
  await db.upsertConversation(normalizedPhone, { history: [], stage: 'greeting', context: {}, report: null });
  res.json({ ok: true, phone: normalizedPhone, message: 'Conversación reiniciada' });
});

app.post('/start', requireAdminToken, async (req, res) => {
  const { phone, context } = req.body;
  if (!phone) return res.status(400).json({ error: 'Se requiere phone' });
  const normalizedPhone = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
  if (context) await db.setContext(normalizedPhone, context);
  try {
    const result = await handleMessage(normalizedPhone, '[El cliente fue contactado proactivamente por David]');
    await sendMessage(normalizedPhone, result.reply);
    res.json({ ok: true, phone: normalizedPhone, message: result.reply });
  } catch (err) {
    console.error('Error en /start:', err);
    res.status(500).json({ error: err.message });
  }
});

// Follow-up automático
async function checkStaleConversations() {
  try {
    const stale = await db.getStaleConversations(24);
    for (const conv of stale) {
      console.log(`Follow-up automático para ${conv.phone}`);
      await sendMessage(conv.phone,
        'Hola! Te escribo de nuevo de parte de David. ¿Pudiste pensar un poco más sobre el proyecto? Si tenés alguna duda o querés retomar la charla, acá estoy 😊');
      await db.markFollowupSent(conv.phone);
    }
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

// ── Bootstrap ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

db.init().then(async () => {
  // Iniciar servidor HTTP (solo para admin panel + endpoints REST)
  app.listen(PORT, () => {
    console.log(`WPanalista corriendo en puerto ${PORT}`);
    console.log(`Admin: GET /admin`);
    console.log(`Health: GET /health`);
  });

  // Iniciar conexión WhatsApp via Baileys
  // En el primer arranque vas a ver un QR en los logs — escaneálo desde tu cel.
  console.log('[wa] Conectando a WhatsApp via Baileys...');
  startWhatsApp(processIncomingMessage).catch(err => {
    console.error('[wa] FATAL: error iniciando Baileys:', err);
  });

  // Follow-ups
  setInterval(checkStaleConversations, 60 * 60 * 1000);
  console.log('Follow-up checker activo (cada 1 hora)');
}).catch(err => {
  console.error('Error inicializando la base de datos:', err);
  process.exit(1);
});
