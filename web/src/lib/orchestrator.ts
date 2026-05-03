import fs from 'fs';
import path from 'path';
import * as db from './db';
import * as demos from './demos';
import { sendMessage } from './whatsapp';
import { sendEmail } from './mailer';
import type { ConversationReport } from './db';

// data/demos/ está en la raíz del repo (compartido con el legacy Express)
const DEMOS_DIR = path.resolve(process.cwd(), '..', 'data', 'demos');
fs.mkdirSync(DEMOS_DIR, { recursive: true });

function phoneSlug(phone: string): string {
  return (phone || 'unknown').replace(/[^0-9]/g, '');
}

export function localDemoDir(phone: string): string {
  const dir = path.join(DEMOS_DIR, phoneSlug(phone));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getAppUrl(): string {
  return (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
}

interface VersionEntry { version: number; date: string; notes: string }

export async function processNewReport(phone: string, report: ConversationReport): Promise<void> {
  console.log(`[orchestrator] Procesando reporte de ${phone}`);
  try {
    await db.updateDemoStatus(phone, 'generating');
    const conv = await db.getConversation(phone);
    await db.setDemoStartedAt(phone, new Date().toISOString());
    await db.updateClientStage(phone, 'qualified');
    await db.appendTimelineEvent(phone, { event: 'report_generated', note: 'Reporte extraído de la conversación' });

    const { landingHTML, whatsappPng, pdfBuffer } = await demos.generateAllDemos(report);

    const localDir = localDemoDir(phone);
    const versionsFile = path.join(localDir, 'versions.json');
    let versions: VersionEntry[] = [];
    try {
      if (fs.existsSync(versionsFile)) versions = JSON.parse(fs.readFileSync(versionsFile, 'utf-8'));
    } catch { versions = []; }

    const hasExisting = ['landing.html', 'whatsapp.html', 'propuesta.pdf'].some(f =>
      fs.existsSync(path.join(localDir, f)),
    );

    if (hasExisting) {
      const vNum = versions.length + 1;
      const vDir = path.join(localDir, `v${vNum}`);
      fs.mkdirSync(vDir, { recursive: true });
      for (const f of ['landing.html', 'whatsapp.html', 'propuesta.pdf']) {
        const src = path.join(localDir, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(vDir, f));
      }
      versions.push({ version: vNum, date: new Date().toISOString(), notes: conv?.demo_notes || '' });
      fs.writeFileSync(versionsFile, JSON.stringify(versions, null, 2));
    }

    if (landingHTML) fs.writeFileSync(path.join(localDir, 'landing.html'), landingHTML, 'utf-8');
    if (whatsappPng) fs.writeFileSync(path.join(localDir, 'whatsapp.html'), whatsappPng);
    if (pdfBuffer) fs.writeFileSync(path.join(localDir, 'propuesta.pdf'), pdfBuffer);

    await db.updateDemoStatus(phone, 'pending_review');
    await db.setDemoStartedAt(phone, '');
    await db.appendTimelineEvent(phone, { event: 'demos_ready', note: 'Demos generados y listos para revisar' });

    const slug = phoneSlug(phone);
    const reviewUrl = `${getAppUrl()}/admin/review/${encodeURIComponent(phone)}`;
    const landingUrl = `${getAppUrl()}/demos/${slug}/landing.html`;

    const emailHtml = `
      <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#2563eb;">Demos listos para revisar</h2>
        <p>Cliente: <strong>${report.cliente?.nombre || phone}</strong></p>
        <p>Tipo: ${report.proyecto?.tipo || '-'}</p>
        <p>Se generaron los 3 demos:</p>
        <ul><li>Landing HTML personalizada</li><li>Mockup de WhatsApp</li><li>Mini-propuesta PDF</li></ul>
        <p style="margin-top:24px;">
          <a href="${reviewUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Revisar y aprobar →</a>
        </p>
        <p style="color:#64748b;font-size:13px;margin-top:16px;">Vista previa: <a href="${landingUrl}">${landingUrl}</a></p>
      </div>`;

    try {
      await sendEmail({
        to: process.env.DAVID_EMAIL!,
        subject: `🎨 Demos listos — ${report.cliente?.nombre || phone}`,
        html: emailHtml,
      });
    } catch (err) {
      console.error('[orchestrator] email error:', (err as Error).message);
    }

    try {
      await db.addNotification({
        type: 'demo',
        title: `Demos listos: ${report.cliente?.nombre || phone}`,
        body: `${report.proyecto?.tipo || 'Proyecto'} — listos para revisar`,
        phone,
      });
    } catch (err) {
      console.error('[orchestrator] notif error:', (err as Error).message);
    }

    console.log(`[orchestrator] Flujo completo para ${phone}`);
  } catch (err) {
    console.error('[orchestrator] error general:', err);
    await db.updateDemoStatus(phone, 'error').catch(() => {});
    await db.setDemoStartedAt(phone, '').catch(() => {});
    await db.appendTimelineEvent(phone, { event: 'demo_error', note: (err as Error).message }).catch(() => {});
    try {
      await db.addNotification({ type: 'warning', title: 'Error generando demos', body: `${phone}: ${(err as Error).message}`, phone });
    } catch {}
  }
}

export async function sendApprovedDemoToClient(phone: string): Promise<void> {
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

  await db.upsertConversation(phone, { stage: 'awaiting_feedback' });

  try {
    await sendMessage(phone, `${nombre}, estuve armando algo para vos basado en lo que charlamos. Te paso una propuesta visual así te hacés una idea concreta 👇`);
    messagesSent++;
  } catch (err) { console.error('Error WA intro:', (err as Error).message); }

  if (hasLanding) {
    try {
      await sendMessage(phone, `🌐 *Propuesta visual:*\n${landingUrl}`);
      messagesSent++;
    } catch (err) { console.error('Error WA landing:', (err as Error).message); }
  }

  if (hasWAMockup) {
    try {
      await sendMessage(phone, `📱 *Así se vería el asistente en tu negocio:*\n${mockupUrl}`);
      messagesSent++;
    } catch (err) { console.error('Error WA mockup:', (err as Error).message); }
  }

  const email = conv.report.cliente?.email;
  const pdfPath = path.join(localDir, 'propuesta.pdf');
  if (email && fs.existsSync(pdfPath)) {
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      await sendEmail({
        to: email,
        subject: `Propuesta para ${nombre} — David Taranto`,
        html: `<p>Hola ${nombre},</p><p>Como quedamos, te paso la propuesta formal en PDF adjunta. Cualquier cosa me respondés por WhatsApp.</p><p>Saludos,<br>David</p>`,
        attachments: [{ filename: 'propuesta.pdf', content: pdfBuffer }],
      });
    } catch (err) { console.error('Error email PDF:', (err as Error).message); }
  }

  try {
    await sendMessage(phone, '¿Qué te parece? Si te copa podemos hacer una llamada corta esta semana para cerrar detalles y arrancar. Avisame nomás 💬');
    messagesSent++;
  } catch (err) { console.error('Error WA cierre:', (err as Error).message); }

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
    await db.addNotification({ type: 'demo', title: `Demo enviado a ${nombre}`, body: 'Se mandó la propuesta visual al cliente', phone });
  } catch {}
  console.log(`[orchestrator] Demo enviado a ${phone}`);
}

export async function regenerateDemos(phone: string): Promise<void> {
  const conv = await db.getConversation(phone);
  if (!conv || !conv.report) throw new Error('No hay reporte para regenerar');
  return processNewReport(phone, conv.report);
}
