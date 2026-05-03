import twilio from 'twilio';

let twilioClient: ReturnType<typeof twilio> | null = null;

export function getClient() {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      console.error('[whatsapp] Twilio creds missing');
      return null;
    }
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
}

export function getTwilioNumber(): string {
  return process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
}

export function normalizePhone(phone: string): string {
  return phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
}

// Twilio limita ~1600 chars por mensaje. Splitea respetando saltos de línea.
export function splitMessage(text: string, maxLen = 1500): string[] {
  if (text.length <= maxLen) return [text];
  const out: string[] = [];
  let buf = '';
  for (const line of text.split('\n')) {
    if ((buf + '\n' + line).length > maxLen) {
      if (buf) out.push(buf);
      buf = line;
    } else {
      buf = buf ? buf + '\n' + line : line;
    }
  }
  if (buf) out.push(buf);
  return out;
}

export async function sendMessage(to: string, body: string): Promise<void> {
  const client = getClient();
  if (!client) throw new Error('Twilio not configured');
  const from = getTwilioNumber();
  const target = normalizePhone(to);
  for (const chunk of splitMessage(body)) {
    await client.messages.create({ from, to: target, body: chunk });
  }
}

export async function sendMediaMessage(to: string, body: string, mediaUrl: string): Promise<void> {
  const client = getClient();
  if (!client) throw new Error('Twilio not configured');
  const from = getTwilioNumber();
  await client.messages.create({ from, to: normalizePhone(to), body, mediaUrl: [mediaUrl] });
}
