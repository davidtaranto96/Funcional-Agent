const fs = require('fs');
const path = require('path');

const db = require('./db');
const demos = require('./demos');
const { sendMessage } = require('./whatsapp');
const { sendEmail } = require('./mailer');

const DEMOS_DIR = path.join(__dirname, '..', 'data', 'demos');
fs.mkdirSync(DEMOS_DIR, { recursive: true });

function phoneSlug(phone) {
  return (phone || 'unknown').replace(/[^0-9]/g, '');
}

function localDemoDir(phone) {
  const dir = path.join(DEMOS_DIR, phoneSlug(phone));
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
    await db.updateClientStage(phone, 'qualified');
    await db.appendTimelineEvent(phone, { event: 'report_generated', note: 'Reporte extraído de la conversación' });

    // 1. Generar los 3 demos en paralelo
    const { landingHTML, whatsappPng, pdfBuffer } = await demos.generateAllDemos(report);

    // 2. Guardar copias locales (para servir por HTTP al cliente)
    const localDir = localDemoDir(phone);
    if (landingHTML) fs.writeFileSync(path.join(localDir, 'landing.html'), landingHTML, 'utf-8');
    if (whatsappPng)  fs.writeFileSync(path.join(localDir, 'whatsapp.html'), whatsappPng);
    if (pdfBuffer)    fs.writeFileSync(path.join(localDir, 'propuesta.pdf'), pdfBuffer);

    await db.updateDemoStatus(phone, 'pending_review');
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

    try {
      await sendMessage(process.env.DAVID_PHONE,
        `🎨 *Demos listos para revisar*\n\n${report.cliente?.nombre || phone}\n\n${reviewUrl}`);
    } catch (err) {
      console.error('[orchestrator] Error mandando WA de review:', err.message);
    }

    console.log(`[orchestrator] Flujo completo para ${phone}`);
  } catch (err) {
    console.error('[orchestrator] Error general:', err);
    await db.updateDemoStatus(phone, 'error').catch(() => {});
    await db.appendTimelineEvent(phone, { event: 'demo_error', note: err.message }).catch(() => {});
    try {
      await sendMessage(process.env.DAVID_PHONE,
        `⚠️ *Error generando demos*\nCliente: ${phone}\nError: ${err.message}`);
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

  // Transición al agente: ahora espera feedback del cliente sobre el demo
  await db.upsertConversation(phone, { stage: 'awaiting_feedback' });

  try {
    await sendMessage(phone,
      `${nombre}, estuve armando algo para vos basado en lo que charlamos. Te paso una propuesta visual así te hacés una idea concreta 👇`);
  } catch (err) { console.error('Error WA intro:', err.message); }

  if (hasLanding) {
    try {
      await sendMessage(phone, `🌐 *Propuesta visual:*\n${landingUrl}`);
    } catch (err) { console.error('Error WA landing:', err.message); }
  }

  if (hasWAMockup) {
    try {
      await sendMessage(phone, `📱 *Así se vería el asistente en tu negocio:*\n${mockupUrl}`);
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
        attachments: [{ filename: 'propuesta.pdf', content: pdfBuffer.toString('base64') }],
      });
    } catch (err) { console.error('Error email PDF:', err.message); }
  }

  try {
    await sendMessage(phone,
      '¿Qué te parece? Si te copa podemos hacer una llamada corta esta semana para cerrar detalles y arrancar. Avisame nomás 💬');
  } catch (err) { console.error('Error WA cierre:', err.message); }

  await db.updateDemoStatus(phone, 'sent');
  await db.updateClientStage(phone, 'demo_sent');
  await db.appendTimelineEvent(phone, { event: 'demo_sent_to_client', note: 'Demo enviado al cliente' });

  try {
    await sendMessage(process.env.DAVID_PHONE, `✅ *Demo enviado a ${nombre}*\n📱 ${phone}`);
  } catch (err) {}

  console.log(`[orchestrator] Demo enviado a ${phone}`);
}

// ============ Regenerar demos manualmente ============
async function regenerateDemos(phone) {
  const conv = await db.getConversation(phone);
  if (!conv || !conv.report) throw new Error('No hay reporte para regenerar');
  return processNewReport(phone, conv.report);
}

module.exports = { processNewReport, sendApprovedDemoToClient, regenerateDemos };
