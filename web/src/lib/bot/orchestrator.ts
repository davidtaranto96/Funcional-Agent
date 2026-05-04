// @ts-nocheck
import fs from 'fs';
import path from 'path';

import * as db from '@/lib/db';
import * as demos from './demos';
import { sendMessage } from './whatsapp';
import { sendEmail } from './mailer';

import { resolveDataDir } from './data-dir';
let _DEMOS_DIR: string | null = null;
function DEMOS_DIR(): string {
  if (_DEMOS_DIR) return _DEMOS_DIR;
  _DEMOS_DIR = path.join(resolveDataDir(), 'demos');
  try { fs.mkdirSync(_DEMOS_DIR, { recursive: true }); } catch (e: any) { console.error('[orchestrator] mkdir DEMOS_DIR:', e.message); }
  return _DEMOS_DIR;
}

function phoneSlug(phone) {
  return (phone || 'unknown').replace(/[^0-9]/g, '');
}

function localDemoDir(phone) {
  const dir = path.join(DEMOS_DIR(), phoneSlug(phone));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getAppUrl() {
  return (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
}

// ============ FLUJO 1: cuando se confirma un nuevo reporte ============
async function processNewReport(phone, report) {
  console.log(`[orchestrator] Procesando nuevo reporte de ${phone}`);
  try {
    await db.updateDemoStatus(phone, 'generating');
    const conv = await db.getConversation(phone);
    await db.setDemoStartedAt(phone, new Date().toISOString());
    await db.updateClientStage(phone, 'qualified');
    await db.appendTimelineEvent(phone, { event: 'report_generated', note: 'Reporte extraído de la conversación' });

    // 1. Generar los 3 demos en paralelo
    const { landingHTML, whatsappPng, pdfBuffer } = await demos.generateAllDemos(report);

    // 2. Guardar copias locales (para servir por HTTP al cliente)
    const localDir = localDemoDir(phone);

    // Backup previous version before overwriting
    const versionsFile = path.join(localDir, 'versions.json');
    let versions = [];
    try {
      if (fs.existsSync(versionsFile)) {
        versions = JSON.parse(fs.readFileSync(versionsFile, 'utf-8'));
      }
    } catch(e) { versions = []; }

    const hasExisting = fs.existsSync(path.join(localDir, 'landing.html')) ||
                        fs.existsSync(path.join(localDir, 'whatsapp.html')) ||
                        fs.existsSync(path.join(localDir, 'propuesta.pdf'));

    if (hasExisting) {
      const vNum = versions.length + 1;
      const vDir = path.join(localDir, `v${vNum}`);
      fs.mkdirSync(vDir, { recursive: true });

      // Copy current files to version directory
      for (const f of ['landing.html', 'whatsapp.html', 'propuesta.pdf']) {
        const src = path.join(localDir, f);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(vDir, f));
        }
      }

      versions.push({
        version: vNum,
        date: new Date().toISOString(),
        notes: conv?.demo_notes || '',
      });
      fs.writeFileSync(versionsFile, JSON.stringify(versions, null, 2));
    }

    if (landingHTML) fs.writeFileSync(path.join(localDir, 'landing.html'), landingHTML, 'utf-8');
    if (whatsappPng)  fs.writeFileSync(path.join(localDir, 'whatsapp.html'), whatsappPng);
    if (pdfBuffer)    fs.writeFileSync(path.join(localDir, 'propuesta.pdf'), pdfBuffer);

    await db.updateDemoStatus(phone, 'pending_review');
    await db.setDemoStartedAt(phone, ''); // Clear the timer
    await db.appendTimelineEvent(phone, { event: 'demos_ready', note: 'Demos generados y listos para revisar' });

    // 3. Notificar a David con el link de revisión
    const slug = phoneSlug(phone);
    const reviewUrl = `${getAppUrl()}/admin/review/${encodeURIComponent(phone)}`;
    const landingUrl = `${getAppUrl()}/demos/${slug}/landing.html`;

    const emailHtml = `
      <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#2563eb;">Demos listos para revisar</h2>
        <p>Cliente: <strong>${report.cliente?.nombre || phone}</strong></p>
        <p>Tipo: ${report.proyecto?.tipo || '-'}</p>
        <p>Se generaron los 3 demos y están listos para tu aprobación:</p>
        <ul>
          <li>Landing HTML personalizada</li>
          <li>Mockup de WhatsApp</li>
          <li>Mini-propuesta PDF</li>
        </ul>
        <p style="margin-top:24px;">
          <a href="${reviewUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
            Revisar y aprobar →
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;margin-top:16px;">
          Vista previa rápida: <a href="${landingUrl}">${landingUrl}</a>
        </p>
      </div>
    `;

    try {
      await sendEmail({
        to: process.env.DAVID_EMAIL,
        subject: `🎨 Demos listos — ${report.cliente?.nombre || phone}`,
        html: emailHtml,
      });
    } catch (err) {
      console.error('[orchestrator] Error mandando email de review:', err.message);
    }

    // Notificación in-app (sin spam a WhatsApp)
    try {
      await db.addNotification({
        type: 'demo',
        title: `Demos listos: ${report.cliente?.nombre || phone}`,
        body: `${report.proyecto?.tipo || 'Proyecto'} — listos para revisar y aprobar`,
        phone,
      });
    } catch (err) {
      console.error('[orchestrator] Error creando notificación:', err.message);
    }

    console.log(`[orchestrator] Flujo completo para ${phone}`);
  } catch (err) {
    console.error('[orchestrator] Error general:', err);
    await db.updateDemoStatus(phone, 'error').catch(() => {});
    await db.setDemoStartedAt(phone, '').catch(() => {});
    await db.appendTimelineEvent(phone, { event: 'demo_error', note: err.message }).catch(() => {});
    try {
      await db.addNotification({ type: 'warning', title: 'Error generando demos', body: `${phone}: ${err.message}`, phone });
    } catch (e) {}
  }
}

// ============ FLUJO 2: David aprueba y se envía al cliente ============
async function sendApprovedDemoToClient(phone) {
  console.log(`[orchestrator] Enviando demo aprobado a ${phone}`);
  const conv = await db.getConversation(phone);
  if (!conv) throw new Error('Conversación no encontrada');
  if (!conv.report) throw new Error('No hay reporte asociado');

  const nombre = conv.report.cliente?.nombre || 'Hola';
  const slug = phoneSlug(phone);
  const landingUrl = `${getAppUrl()}/demos/${slug}/landing.html`;
  const mockupUrl = `${getAppUrl()}/demos/${slug}/whatsapp.html`;
  const localDir = localDemoDir(phone);

  const hasLanding = fs.existsSync(path.join(localDir, 'landing.html'));
  const hasWAMockup = fs.existsSync(path.join(localDir, 'whatsapp.html'));
  let messagesSent = 0;

  // Transición al agente: ahora espera feedback del cliente sobre el demo
  await db.upsertConversation(phone, { stage: 'awaiting_feedback' });

  try {
    await sendMessage(phone,
      `${nombre}, estuve armando algo para vos basado en lo que charlamos. Te paso una propuesta visual así te hacés una idea concreta 👇`);
    messagesSent++;
  } catch (err) { console.error('Error WA intro:', err.message); }

  if (hasLanding) {
    try {
      await sendMessage(phone, `🌐 *Propuesta visual:*\n${landingUrl}`);
      messagesSent++;
    } catch (err) { console.error('Error WA landing:', err.message); }
  }

  if (hasWAMockup) {
    try {
      await sendMessage(phone, `📱 *Así se vería el asistente en tu negocio:*\n${mockupUrl}`);
      messagesSent++;
    } catch (err) { console.error('Error WA mockup:', err.message); }
  }

  const email = conv.report.cliente?.email;
  const pdfPath = path.join(localDir, 'propuesta.pdf');
  if (email && fs.existsSync(pdfPath)) {
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      await sendEmail({
        to: email,
        subject: `Propuesta para ${nombre} — David Taranto`,
        html: `<p>Hola ${nombre},</p>
          <p>Como quedamos, te paso la propuesta formal en PDF adjunta. Cualquier cosa me respondés por WhatsApp.</p>
          <p>Saludos,<br>David</p>`,
        attachments: [{ filename: 'propuesta.pdf', content: pdfBuffer }],
      });
    } catch (err) { console.error('Error email PDF:', err.message); }
  }

  try {
    await sendMessage(phone,
      '¿Qué te parece? Si te copa podemos hacer una llamada corta esta semana para cerrar detalles y arrancar. Avisame nomás 💬');
    messagesSent++;
  } catch (err) { console.error('Error WA cierre:', err.message); }

  if (messagesSent === 0) {
    console.error('[orchestrator] No se pudo enviar ningún mensaje a', phone);
    await db.updateDemoStatus(phone, 'error');
    await db.appendTimelineEvent(phone, { event: 'demo_send_failed', note: 'Todos los intentos de envío fallaron' });
    return;
  }

  await db.updateDemoStatus(phone, 'sent');
  await db.updateClientStage(phone, 'demo_sent');
  await db.appendTimelineEvent(phone, { event: 'demo_sent_to_client', note: 'Demo enviado al cliente' });

  try {
    await db.addNotification({ type: 'demo', title: `Demo enviado a ${nombre}`, body: `Se mandó la propuesta visual al cliente`, phone });
  } catch (err) {}

  console.log(`[orchestrator] Demo enviado a ${phone}`);
}

// ============ Regenerar demos manualmente ============
async function regenerateDemos(phone) {
  const conv = await db.getConversation(phone);
  if (!conv || !conv.report) throw new Error('No hay reporte para regenerar');
  return processNewReport(phone, conv.report);
}

export { processNewReport, sendApprovedDemoToClient, regenerateDemos };
