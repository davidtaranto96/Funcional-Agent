import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { handleMessage } from '@/lib/agent';
import { sendMessage } from '@/lib/whatsapp';
import { transcribe } from '@/lib/transcriber';
import { sendReport as sendEmailReport } from '@/lib/mailer';
import { generateReport, formatReportEmail } from '@/lib/reports';
import { processNewReport, sendApprovedDemoToClient, regenerateDemos } from '@/lib/orchestrator';
import * as calendar from '@/lib/calendar';
import { validateTwilioSignature, getPublicUrl } from '@/lib/twilio-verify';
import { normalizeARPhone } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Buffer en memoria para diagnóstico — gateado por requireAdminToken vía /api/webhook/last
const lastWebhooks: Array<{ time: string; From: string; Body: string; NumMedia: number; MediaType0: string; MediaUrl0: string }> = [];

function twimlReply(text?: string): NextResponse {
  if (!text) return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return new NextResponse(`<Response><Message>${safe}</Message></Response>`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

export async function POST(req: NextRequest) {
  // 1. Parse form body (Twilio manda application/x-www-form-urlencoded)
  const formData = await req.formData();
  const body: Record<string, string> = {};
  for (const [k, v] of formData.entries()) body[k] = String(v);

  // 2. Validar firma Twilio (X-Twilio-Signature contra URL pública + body)
  const signature = req.headers.get('x-twilio-signature');
  const publicUrl = await getPublicUrl(req);
  const isValid = await validateTwilioSignature(publicUrl, body, signature);
  if (!isValid) {
    console.error('[webhook] Twilio signature inválida — rechazado');
    return new NextResponse('<Response/>', { status: 403, headers: { 'Content-Type': 'text/xml' } });
  }

  try {
    const From = body.From || '';
    const Body = body.Body || '';
    const NumMedia = parseInt(body.NumMedia || '0');
    const MediaUrl0 = body.MediaUrl0 || '';
    const MediaType0 = body.MediaContentType0 || '';

    console.log(`[webhook] From=${From} Body="${Body.substring(0, 80)}" NumMedia=${NumMedia} MediaType=${MediaType0}`);

    lastWebhooks.unshift({
      time: new Date().toISOString(),
      From, Body: Body.substring(0, 100),
      NumMedia, MediaType0, MediaUrl0: MediaUrl0.substring(0, 120),
    });
    if (lastWebhooks.length > 10) lastWebhooks.length = 10;

    if (!From) return twimlReply();

    const fromKey = From.startsWith('whatsapp:') ? From : `whatsapp:${From}`;
    const text = Body.trim();

    // ── Audio: respond immediately, transcribe in background ──
    if (NumMedia > 0 && MediaUrl0 && MediaType0.startsWith('audio/')) {
      // En Next.js no podemos hacer "fire and forget" después de responder igual que Express.
      // Solución: responder TwiML y procesar en background sin await (la promesa sigue corriendo).
      processAudioInBackground(fromKey, MediaUrl0).catch(err => console.error('[bg-audio]', err));
      return twimlReply('🎙️ Recibí tu audio, dame unos segundos que lo proceso...');
    }

    if (!text && NumMedia > 0 && !MediaType0.startsWith('audio/')) {
      return twimlReply('Por ahora solo puedo leer texto y audios. Si me querés mandar algo, escribilo o grabá un audio.');
    }
    if (!text) return twimlReply('No pude entender el audio. ¿Podrías escribirlo o grabar otro?');

    // ── Comandos admin de David ──
    const davidPhone = normalizeARPhone((process.env.DAVID_PHONE || '').replace('whatsapp:', '').replace('+', ''));
    if (normalizeARPhone(From) === davidPhone) {
      const cmd = text.toUpperCase();
      const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
      const adminResp = await handleAdminCommand(cmd, text, appUrl);
      if (adminResp) return twimlReply(adminResp);
      // Si no es comando, cae al flujo normal abajo
    }

    // ── Flujo normal con el agente ──
    const result = await handleMessage(fromKey, text);

    // Calendar: needsCalendarSlots
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
        console.error('[calendar] error:', (err as Error).message);
      }
    }

    // Calendar: selectedSlotIndex
    if (result.selectedSlotIndex !== null) {
      try {
        const conv = await db.getConversation(fromKey);
        const slotsData = (conv?.context?.pendingSlots as { start: string; end: string }[] | undefined) || [];
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
          db.addNotification({ type: 'meeting', title: `Reunión agendada con ${clientName}`, body: `${slotLabel}${meetLink ? ' — ' + meetLink : ''}`, phone: fromKey })
            .catch(e => console.error('[calendar] notif:', (e as Error).message));
        }
      } catch (err) {
        console.error('[calendar] event error:', (err as Error).message);
        result.reply += '\n\n(Voy a coordinar el horario con David, en un rato te confirman)';
      }
    }

    // Background work: report generation, demos, notifications — fire and forget
    processBackgroundFlow(fromKey, result, text).catch(err => console.error('[bg-flow]', err));

    return twimlReply(result.reply);
  } catch (err) {
    console.error('[webhook] error fatal:', err);
    return twimlReply('Perdón, tuve un error. ¿Podés intentar de nuevo?');
  }
}

// ─── Comandos admin de David ──────────────────────────────────────────────
async function handleAdminCommand(cmd: string, text: string, appUrl: string): Promise<string | null> {
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
    const parts = text.split(/\s+/);
    let targetPhone: string;
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
    sendApprovedDemoToClient(targetPhone).catch(console.error);
    return `✅ Aprobado. Mandando demo a ${nombre}...`;
  }

  if (cmd.startsWith('RECHAZAR')) {
    const parts = text.split(/\s+/);
    let targetPhone: string;
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
    const parts = text.split(/\s+/);
    let targetPhone = parts.length > 1 ? parts.slice(1).join('').trim() : null;
    if (targetPhone && !targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:+${targetPhone.replace(/[^0-9]/g, '')}`;
    const all = await db.listAllClients();
    if (!targetPhone) {
      const resumen = all.slice(0, 5).map(c => {
        const nombre = c.report?.cliente?.nombre || c.phone;
        return `• ${nombre} — etapa: ${c.stage} | demo: ${c.demo_status}`;
      }).join('\n');
      return `📊 Últimos 5 clientes:\n\n${resumen || 'Sin clientes aún.'}`;
    }
    const conv = await db.getConversation(targetPhone);
    if (!conv) return `❌ No encontré al cliente ${targetPhone}`;
    const nombre = conv.report?.cliente?.nombre || targetPhone;
    const timeline = (conv.timeline || []).slice(-3).map(e => `• ${e.event}: ${e.note || ''}`).join('\n');
    return `📋 ${nombre}\nEtapa: ${conv.stage}\nDemo: ${conv.demo_status}\n\nÚltimos eventos:\n${timeline || '(vacío)'}`;
  }

  if (cmd.startsWith('REPORTE')) {
    const parts = text.split(/\s+/);
    let targetPhone = parts.length > 1 ? parts.slice(1).join('').trim() : null;
    if (!targetPhone) return '⚠️ Usá: REPORTE +5493878599185';
    if (!targetPhone.startsWith('whatsapp:')) targetPhone = `whatsapp:+${targetPhone.replace(/[^0-9]/g, '')}`;
    const conv = await db.getConversation(targetPhone);
    if (!conv?.report) return `❌ ${targetPhone} no tiene reporte todavía.`;
    regenerateDemos(targetPhone).catch(console.error);
    return `🔄 Regenerando demos para ${conv.report?.cliente?.nombre || targetPhone}...`;
  }

  if (cmd === 'AYUDA' || cmd === 'HELP') {
    return `Comandos disponibles:\n\n• PENDIENTES — demos esperando aprobación\n• APROBAR — aprobar demo más reciente\n• APROBAR +549... — aprobar de número específico\n• RECHAZAR — rechazar demo más reciente\n• STATUS — últimos 5 clientes\n• STATUS +549... — estado de un cliente\n• REPORTE +549... — regenerar demos\n\nPanel web: ${appUrl}/admin`;
  }

  return null;
}

// ─── Audio en background ──────────────────────────────────────────────────
async function processAudioInBackground(fromKey: string, mediaUrl: string) {
  let audioText = '';
  try {
    audioText = (await transcribe(mediaUrl)) || '';
  } catch (err) {
    console.error('[bg-audio] transcribe error:', (err as Error).message);
  }
  console.log(`[bg-audio] transcripción: "${audioText.substring(0, 100)}"`);
  if (!audioText.trim()) {
    await sendMessage(fromKey, 'No pude entender el audio. ¿Podrías escribirlo o grabar otro?');
    return;
  }

  const result = await handleMessage(fromKey, audioText);

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
      }
    } catch (err) { console.error('[bg-audio] calendar:', (err as Error).message); }
  }

  if (result.selectedSlotIndex !== null) {
    try {
      const conv = await db.getConversation(fromKey);
      const slotsData = (conv?.context?.pendingSlots as { start: string; end: string }[] | undefined) || [];
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
      }
    } catch (err) { console.error('[bg-audio] event:', (err as Error).message); }
  }

  await sendMessage(fromKey, result.reply);
  await processBackgroundFlow(fromKey, result, audioText);
}

// ─── Trabajo pesado en background (reportes, demos, notificaciones) ──────
async function processBackgroundFlow(fromKey: string, result: { stage: string; previousStage: string; wantsChanges: boolean }, text: string) {
  if (result.stage === 'done' && result.previousStage === 'confirming') {
    try {
      console.log(`[bg-flow] ${fromKey} confirming→done — generando reporte`);
      const conv = await db.getConversation(fromKey);
      if (!conv) return;
      const report = await generateReport(conv.history, fromKey);
      await db.upsertConversation(fromKey, { report });
      const nombre = report?.cliente?.nombre || fromKey;
      await db.addNotification({ type: 'lead', title: `Nuevo reporte: ${nombre}`, body: `${report?.proyecto?.tipo || 'Proyecto'} — listo para generar demos`, phone: fromKey });
      try { const html = formatReportEmail(report); await sendEmailReport(report, html); } catch (e) { console.error('[bg-flow] email:', (e as Error).message); }
      try { await sendMessage(fromKey, '🎨 ¡Perfecto! Ya le pasé todo a David. En unos minutos te mando una propuesta visual por acá mismo.'); } catch (e) { console.error('[bg-flow] confirm:', (e as Error).message); }
      processNewReport(fromKey, report).catch(err => {
        console.error('[bg-flow] orchestrator:', err);
        db.addNotification({ type: 'warning', title: 'Error generando demos', body: (err as Error).message, phone: fromKey }).catch(() => {});
      });
    } catch (err) {
      console.error('[bg-flow] reporte:', err);
      db.addNotification({ type: 'warning', title: 'Error generando reporte', body: (err as Error).message, phone: fromKey }).catch(() => {});
    }
  }

  if (result.stage === 'done' && result.previousStage === 'done' && text) {
    try {
      const conv = await db.getConversation(fromKey);
      const nombre = conv?.report?.cliente?.nombre || fromKey;
      await db.addNotification({ type: 'info', title: `${nombre} pidió un cambio`, body: text.slice(0, 200), phone: fromKey });
      await db.appendTimelineEvent(fromKey, { event: 'client_requested_change', note: text.slice(0, 200) });
    } catch (e) { console.error('[bg-flow] notify mod:', (e as Error).message); }
  }

  if (result.wantsChanges) {
    try {
      const conv = await db.getConversation(fromKey);
      const nombre = conv?.report?.cliente?.nombre || fromKey;
      await db.addNotification({ type: 'demo', title: `${nombre} quiere ajustes en la propuesta`, body: text.slice(0, 200), phone: fromKey });
      await db.appendTimelineEvent(fromKey, { event: 'client_wants_changes', note: text.slice(0, 200) });
    } catch (e) { console.error('[bg-flow] notify changes:', (e as Error).message); }
  }
}

// Exportar para que /api/webhook/last lo lea
export function getLastWebhooks() {
  return lastWebhooks;
}
