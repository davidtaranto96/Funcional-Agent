import { Resend } from 'resend';

let resend: Resend | null = null;

function getClient() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

interface Attachment {
  filename: string;
  content: Buffer;
}

export async function sendReport(report: { cliente?: { nombre?: string; telefono?: string }; proyecto?: { tipo?: string } }, html: string): Promise<void> {
  const nombre = report.cliente?.nombre || report.cliente?.telefono || 'Nuevo lead';
  const tipo = report.proyecto?.tipo || 'Proyecto';

  const { error } = await getClient().emails.send({
    from: process.env.RESEND_FROM || 'WPanalista <onboarding@resend.dev>',
    to: [process.env.DAVID_EMAIL!],
    subject: `Nuevo lead: ${nombre} — ${tipo}`,
    html,
  });

  if (error) {
    console.error('Error enviando email:', error);
    throw new Error(`Email failed: ${error.message}`);
  }
}

export async function sendEmail(opts: { to: string | string[]; subject: string; html: string; attachments?: Attachment[] }): Promise<void> {
  const payload: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    attachments?: Attachment[];
  } = {
    from: process.env.RESEND_FROM || 'WPanalista <onboarding@resend.dev>',
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.attachments?.length) payload.attachments = opts.attachments;

  const { error } = await getClient().emails.send(payload);
  if (error) {
    console.error('Error enviando email:', error);
    throw new Error(`Email failed: ${error.message}`);
  }
}
