// @ts-nocheck
// Triggers de notificacion email para David. Cada trigger tiene un cooldown
// para evitar spamear (ej: si entran 10 mensajes seguidos en pausa, 1 sola
// notif por chat cada 10 min).

import { sendEmail } from './mailer';

// Cooldown in-memory (per-process). Key: `${trigger}:${phone}` → last sent ts.
// Si el proceso se reinicia se resetea — esta bien, mejor pecar por ruido
// post-restart que perder notif.
const cooldowns = new Map();
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos

function shouldSkip(key) {
  const last = cooldowns.get(key);
  if (last && Date.now() - last < COOLDOWN_MS) return true;
  cooldowns.set(key, Date.now());
  return false;
}

function appUrl() {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Mensaje entrante en una conversación pausada. David esta tomando control
// manual y necesita enterarse.
export async function notifyManualMessage(phone, clientName, messageText) {
  if (!process.env.DAVID_EMAIL || !process.env.RESEND_API_KEY) {
    console.log('[notify] DAVID_EMAIL o RESEND_API_KEY faltan, skip');
    return;
  }
  if (shouldSkip(`manual:${phone}`)) {
    console.log(`[notify] cooldown manual:${phone}`);
    return;
  }

  const phoneSlug = encodeURIComponent(phone);
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 540px; margin: 0 auto;">
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px;">
        <strong style="color: #92400e;">Modo manual activo</strong>
      </div>
      <h2 style="color: #111; margin: 20px 0 8px;">Nuevo mensaje de ${escapeHtml(clientName || phone)}</h2>
      <p style="color: #555; margin: 0 0 16px;">El bot está pausado para esta conversación. Vos tenés que responder.</p>
      <blockquote style="margin: 16px 0; padding: 12px 16px; background: #f3f4f6; border-radius: 6px; color: #111; font-style: italic;">
        "${escapeHtml(messageText.slice(0, 500))}"
      </blockquote>
      <a href="${appUrl()}/admin/client/${phoneSlug}"
         style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        Responder ahora →
      </a>
      <p style="color: #999; font-size: 11px; margin-top: 24px;">
        WPanalista · Cooldown 10min para evitar spam.
      </p>
    </div>
  `;

  try {
    await sendEmail({
      to: process.env.DAVID_EMAIL,
      subject: `Manual: respuesta nueva de ${clientName || phone}`,
      html,
    });
    console.log(`[notify] ✅ email manual enviado por ${phone}`);
  } catch (err) {
    console.error('[notify] manual email fallo:', err.message);
  }
}

// Lead caliente detectado por scoring. David tiene que actuar rápido.
export async function notifyHotLead(phone, clientName, reason) {
  if (!process.env.DAVID_EMAIL || !process.env.RESEND_API_KEY) return;
  if (shouldSkip(`hot:${phone}`)) {
    console.log(`[notify] cooldown hot:${phone}`);
    return;
  }

  const phoneSlug = encodeURIComponent(phone);
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 540px; margin: 0 auto;">
      <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 6px;">
        <strong style="color: #991b1b;">🔥 Lead HOT detectado</strong>
      </div>
      <h2 style="color: #111; margin: 20px 0 8px;">${escapeHtml(clientName || phone)}</h2>
      <p style="color: #555; margin: 0 0 16px;">El bot evaluó la conversación como caliente. Atendelo cuanto antes.</p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
        <strong style="color: #111; font-size: 13px;">Razón:</strong>
        <p style="color: #333; margin: 4px 0 0;">${escapeHtml(reason)}</p>
      </div>
      <a href="${appUrl()}/admin/client/${phoneSlug}"
         style="display: inline-block; background: #dc2626; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        Ver conversación →
      </a>
    </div>
  `;

  try {
    await sendEmail({
      to: process.env.DAVID_EMAIL,
      subject: `🔥 Lead HOT: ${clientName || phone}`,
      html,
    });
    console.log(`[notify] ✅ email hot enviado por ${phone}`);
  } catch (err) {
    console.error('[notify] hot email fallo:', err.message);
  }
}
