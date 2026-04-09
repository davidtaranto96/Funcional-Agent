const { Resend } = require('resend');

let resend;
function getClient() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

async function sendReport(report, html) {
  const nombre = report.cliente?.nombre || report.cliente?.telefono || 'Nuevo lead';
  const tipo = report.proyecto?.tipo || 'Proyecto';

  const { error } = await getClient().emails.send({
    // En dev usar onboarding@resend.dev (solo manda al email del dueño de la cuenta)
    from: process.env.RESEND_FROM || 'WPanalista <onboarding@resend.dev>',
    to: [process.env.DAVID_EMAIL],
    subject: `Nuevo lead: ${nombre} — ${tipo}`,
    html,
  });

  if (error) {
    console.error('Error enviando email:', error);
    throw new Error(`Email failed: ${error.message}`);
  }
}

// Envío genérico: permite pasar destinatario, asunto, html y adjuntos opcionales
async function sendEmail({ to, subject, html, attachments }) {
  const payload = {
    from: process.env.RESEND_FROM || 'WPanalista <onboarding@resend.dev>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (attachments && attachments.length) {
    payload.attachments = attachments;
  }
  const { error } = await getClient().emails.send(payload);
  if (error) {
    console.error('Error enviando email:', error);
    throw new Error(`Email failed: ${error.message}`);
  }
}

module.exports = { sendReport, sendEmail };
