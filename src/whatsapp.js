// Twilio — envío de mensajes WhatsApp Business

const twilio = require('twilio');

function getClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function getTwilioNumber() {
  // Debe estar en formato "whatsapp:+14155238886"
  const n = process.env.TWILIO_WHATSAPP_NUMBER || '';
  return n.startsWith('whatsapp:') ? n : `whatsapp:${n}`;
}

// Normaliza cualquier formato de teléfono a "whatsapp:+XXXXXXXX"
function normalizePhone(phone) {
  if (phone.startsWith('whatsapp:+')) return phone;
  if (phone.startsWith('whatsapp:')) return phone.replace('whatsapp:', 'whatsapp:+');
  const digits = phone.replace(/[^0-9]/g, '');
  return `whatsapp:+${digits}`;
}

// Split automático si supera 1600 chars (límite de WhatsApp via Twilio)
function splitMessage(text, maxLen = 1600) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf('\n\n', maxLen);
    if (splitAt === -1 || splitAt < maxLen * 0.3) splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt === -1 || splitAt < maxLen * 0.3) splitAt = remaining.lastIndexOf(' ', maxLen);
    if (splitAt === -1) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function sendMessage(to, body) {
  const client = getClient();
  const toPhone = normalizePhone(to);
  const from = getTwilioNumber();
  const chunks = splitMessage(body);

  for (let i = 0; i < chunks.length; i++) {
    await client.messages.create({
      from,
      to: toPhone,
      body: chunks[i],
    });

    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

// Manda mensaje con media (imagen, PDF, etc.) via URL pública
async function sendMediaMessage(to, body, mediaUrl) {
  const client = getClient();
  const toPhone = normalizePhone(to);
  const from = getTwilioNumber();

  const url = Array.isArray(mediaUrl) ? mediaUrl[0] : mediaUrl;

  await client.messages.create({
    from,
    to: toPhone,
    body: body || '',
    mediaUrl: [url],
  });
}

module.exports = { sendMessage, sendMediaMessage };
