// @ts-nocheck
// Bootstrap del bot WhatsApp — se invoca desde instrumentation.ts al startup.
import * as db from '@/lib/db';
import { startWhatsApp, sendMessage, type IncomingMessage } from './whatsapp';
import { transcribe } from './transcriber';
import { handleMessage } from './agent';
import * as orchestrator from './orchestrator';
import * as calendar from './calendar';
import { generateReport, formatReportEmail } from './reports';
import { sendReport as sendEmailReport } from './mailer';

// ── Comandos admin desde el WhatsApp de David ───────────────────────────────
async function handleAdminCommand(fromKey: string, text: string): Promise<string | null> {
  const normalizeAR = (num: string): string => {
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
    // Lite: hot path del bot, no necesitamos parsear history/timeline.
    const pendientes = (await db.listAllClientsLite()).filter((c: any) => c.demo_status === 'pending_review');
    if (pendientes.length === 0) return '✅ No hay demos pendientes de revisión.';
    const lista = pendientes.map((c: any) => {
      const nombre = c.clientName || c.phone;
      return `• ${nombre}\n  ${appUrl}/admin/review/${encodeURIComponent(c.phone)}`;
    }).join('\n\n');
    return `📋 Demos pendientes (${pendientes.length}):\n\n${lista}`;
  }

  if (cmd.startsWith('APROBAR')) {
    const parts = text.trim().split(/\s+/);
    let targetPhone: string;
    if (parts.length > 1) {
      targetPhone = parts.slice(1).join('').trim();
      if (!targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:${targetPhone}`;
    } else {
      const pendientes = (await db.listAllClientsLite()).filter((c: any) => c.demo_status === 'pending_review');
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
    let targetPhone: string;
    if (parts.length > 1) {
      targetPhone = parts.slice(1).join('').trim();
      if (!targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:${targetPhone}`;
    } else {
      const pendientes = (await db.listAllClientsLite()).filter((c: any) => c.demo_status === 'pending_review');
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
    if (targetPhone && !targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:+${targetPhone.replace(/[^0-9]/g, '')}`;
    const all = await db.listAllClientsLite();
    if (!targetPhone) {
      const resumen = all.slice(-5).map((c: any) => {
        const nombre = c.clientName || c.phone;
        return `• ${nombre} — etapa: ${c.stage} | demo: ${c.demo_status}`;
      }).join('\n');
      return `📊 Últimos 5 clientes:\n\n${resumen || 'Sin clientes aún.'}`;
    }
    const conv = await db.getConversation(targetPhone);
    if (!conv) return `❌ No encontré al cliente ${targetPhone}`;
    const nombre = conv.report?.cliente?.nombre || targetPhone;
    const timeline = (conv.timeline || []).slice(-3).map((e: any) => `• ${e.event}: ${e.note || ''}`).join('\n');
    return `📋 ${nombre}\nEtapa: ${conv.stage}\nDemo: ${conv.demo_status}\n\nÚltimos eventos:\n${timeline || '(vacío)'}`;
  }

  if (cmd.startsWith('REPORTE')) {
    const parts = text.trim().split(/\s+/);
    let targetPhone = parts.length > 1 ? parts.slice(1).join('').trim() : null;
    if (!targetPhone) return '⚠️ Usá: REPORTE +5493878599185';
    if (!targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:+${targetPhone.replace(/[^0-9]/g, '')}`;
    const conv = await db.getConversation(targetPhone);
    if (!conv?.report) return `❌ ${targetPhone} no tiene reporte todavía.`;
    orchestrator.processNewReport(targetPhone, conv.report).catch(console.error);
    return `🔄 Regenerando demos para ${conv.report?.cliente?.nombre || targetPhone}...`;
  }

  if (cmd === 'AYUDA' || cmd === 'HELP') {
    return `Comandos:\n• PENDIENTES\n• APROBAR [+549...]\n• RECHAZAR [+549...]\n• STATUS [+549...]\n• REPORTE +549...\n\nPanel: ${appUrl}/admin`;
  }

  return null;
}

// ── Procesador principal de mensajes entrantes ──────────────────────────────
async function processIncomingMessage({ fromKey, text, audioBuffer, audioMime, hasMedia }: IncomingMessage): Promise<void> {
  console.log(`[wa] ▶ INCOMING From=${fromKey} text="${(text || '').substring(0, 80)}" audio=${!!audioBuffer} media=${hasMedia}`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[wa] ❌ ANTHROPIC_API_KEY no configurada — el agente no puede responder');
    try { await sendMessage(fromKey, 'Hola! Sistema en mantenimiento, te respondo en un rato.'); } catch (e: any) { console.error('[wa] sendMessage fallback fallo:', e.message); }
    return;
  }

  let actualText = (text || '').trim();

  if (audioBuffer) {
    sendMessage(fromKey, '🎙️ Recibí tu audio, dame unos segundos que lo proceso...').catch(() => { });
    try {
      const transcribed = await transcribe(audioBuffer, { mime: audioMime });
      if (!transcribed || transcribed.startsWith('[')) {
        await sendMessage(fromKey, transcribed || 'No pude entender el audio. ¿Podrías escribirlo o grabar otro?');
        return;
      }
      actualText = transcribed;
    } catch (err: any) {
      console.error('[wa] Error transcribiendo:', err.message);
      await sendMessage(fromKey, 'Perdón, tuve un error procesando el audio. ¿Podés escribirlo o grabar otro?');
      return;
    }
  }

  if (!actualText && hasMedia) {
    await sendMessage(fromKey, 'Por ahora solo puedo leer texto y audios. Si me querés mandar algo, escribilo o grabá un audio.');
    return;
  }
  if (!actualText) return;

  const adminReply = await handleAdminCommand(fromKey, actualText);
  if (adminReply) {
    await sendMessage(fromKey, adminReply);
    return;
  }

  console.log(`[wa] ▶ llamando handleMessage para ${fromKey}, text="${actualText.slice(0, 60)}"`);
  let result: any;
  try {
    result = await handleMessage(fromKey, actualText);
    console.log(`[wa] ◀ handleMessage OK, stage=${result.stage}, replyLen=${(result.reply || '').length}`);
  } catch (err: any) {
    console.error('[wa] ❌ Error en agente:', err?.message || err, err?.stack?.split('\n').slice(0, 3).join(' | '));
    try {
      await sendMessage(fromKey, 'Perdón, tuve un error. ¿Podés intentar de nuevo?');
    } catch (sendErr: any) {
      console.error('[wa] ❌❌ tampoco pude mandar mensaje de error:', sendErr?.message);
    }
    return;
  }

  // Calendario: slots
  if (result.needsCalendarSlots) {
    try {
      const calSlots = await calendar.getAvailableSlots();
      if (calSlots.length > 0) {
        const conv = await db.getConversation(fromKey);
        const slotsData = calSlots.map((s: any) => ({ start: s.start.toISOString(), end: s.end.toISOString() }));
        await db.upsertConversation(fromKey, { context: { ...(conv?.context || {}), pendingSlots: slotsData } });
        const slotsText = calendar.formatSlotsForWhatsApp(calSlots);
        result.reply += `\n\nTe dejo 3 opciones para que elijas la que más te queda:\n\n${slotsText}\n\n¿Cuál te viene mejor?`;
        await db.appendTimelineEvent(fromKey, { event: 'calendar_slots_shown', note: '3 horarios mostrados' });
      } else {
        result.reply += '\n\n(Esta semana David anda un poco justo de horarios, te va a escribir directamente para coordinar)';
      }
    } catch (err: any) { console.error('[calendar] Error buscando horarios:', err.message); }
  }

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
        db.addNotification({ type: 'meeting', title: `Reunión agendada con ${clientName}`, body: `${slotLabel}${meetLink ? ' — ' + meetLink : ''}`, phone: fromKey }).catch((e: any) => console.error('[calendar] Notif:', e.message));
      }
    } catch (err: any) {
      console.error('[calendar] Error creando evento:', err.message);
      result.reply += '\n\n(Voy a coordinar el horario con David, en un rato te confirman)';
    }
  }

  console.log(`[wa] ▶ enviando reply a ${fromKey} (${result.reply.length} chars): "${result.reply.substring(0, 120)}..."`);
  try {
    await sendMessage(fromKey, result.reply);
    console.log(`[wa] ✅ reply enviado OK a ${fromKey}`);
  } catch (sendErr: any) {
    console.error(`[wa] ❌ sendMessage fallo:`, sendErr?.message, sendErr?.stack?.split('\n')[0]);
    return;
  }

  // Background work
  if (result.stage === 'done' && result.previousStage === 'confirming') {
    (async () => {
      try {
        const conv = await db.getConversation(fromKey);
        const report = await generateReport(conv.history, fromKey);
        await db.upsertConversation(fromKey, { report });
        const nombre = report?.cliente?.nombre || fromKey;
        await db.addNotification({ type: 'lead', title: `Nuevo reporte: ${nombre}`, body: `${report?.proyecto?.tipo || 'Proyecto'} — listo para generar demos`, phone: fromKey });
        try { const html = formatReportEmail(report); await sendEmailReport(report, html); } catch (e: any) { console.error('[bg] Email:', e.message); }
        try { await sendMessage(fromKey, '🎨 ¡Perfecto! Ya le pasé todo a David. En unos minutos te mando una propuesta visual por acá mismo.'); } catch (e: any) { console.error('[bg] Confirm client:', e.message); }
        orchestrator.processNewReport(fromKey, report).catch((err: any) => {
          console.error('[bg] orchestrator error:', err);
          db.addNotification({ type: 'warning', title: `Error generando demos`, body: err.message, phone: fromKey }).catch(() => { });
        });
      } catch (err: any) {
        console.error('[bg] Error generando reporte:', err);
        db.addNotification({ type: 'warning', title: 'Error generando reporte', body: err.message, phone: fromKey }).catch(() => { });
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
      } catch (e: any) { console.error('[bg] Notify mod:', e.message); }
    })();
  }

  if (result.wantsChanges) {
    (async () => {
      try {
        const conv = await db.getConversation(fromKey);
        const nombre = conv?.report?.cliente?.nombre || fromKey;
        await db.addNotification({ type: 'demo', title: `${nombre} quiere ajustes en la propuesta`, body: actualText.slice(0, 200), phone: fromKey });
        await db.appendTimelineEvent(fromKey, { event: 'client_wants_changes', note: actualText.slice(0, 200) });
      } catch (e: any) { console.error('[bg] Notify changes:', e.message); }
    })();
  }
}

// ── Follow-up checker ──────────────────────────────────────────────────────
async function checkStaleConversations(): Promise<void> {
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
      const nombre = (conv as any).context?.nombre || conv.phone;
      console.log(`Cliente frío: ${conv.phone}`);
      const davidPhone = process.env.DAVID_PHONE;
      if (davidPhone) {
        await sendMessage(davidPhone,
          `❄️ *Cliente sin respuesta — ${nombre}*\n📱 ${conv.phone}\nNo respondió después de 72hs. Quizás quieras contactarlo directamente.`);
      }
      await db.markAbandoned(conv.phone);
    }
  } catch (err: any) {
    console.error('Error en follow-up check:', err);
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
export async function startBot(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  WPanalista v5.1.0 — Single-service Next.js + Baileys');
  console.log('  Build: ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════');
  console.log('[bot] Inicializando DB...');
  await db.ensureInit();

  console.log('[bot] Conectando a WhatsApp via Baileys...');
  startWhatsApp(processIncomingMessage).catch((err: any) => {
    console.error('[bot] FATAL: error iniciando Baileys:', err);
  });

  // Follow-ups cada 1h
  setInterval(checkStaleConversations, 60 * 60 * 1000);
  console.log('[bot] Follow-up checker activo (cada 1 hora)');
}

export { processIncomingMessage };
