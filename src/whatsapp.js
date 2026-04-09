// Meta Cloud API — reemplaza Twilio para envío de mensajes WhatsApp

function getConfig() {
  return {
    phoneNumberId: process.env.META_PHONE_NUMBER_ID,
    token: process.env.META_ACCESS_TOKEN,
  };
}

// Normaliza el número para Meta Cloud API
// Argentina: 5493878599185 (549+area+local) → 54387815599185 (54+area+15+local)
// Meta sandbox requiere el formato con "15", no con "9"
function normalizePhone(phone) {
  let n = phone.replace('whatsapp:', '').replace(/[^0-9]/g, '');
  // Argentina móvil con 9: 549AREALOCAL → 54AREA15LOCAL
  const arMatch = n.match(/^549(\d{3,4})(\d{6,7})$/);
  if (arMatch) {
    n = `54${arMatch[1]}15${arMatch[2]}`;
  }
  return n;
}

// Manda un mensaje de texto (con split automático si supera 4096 chars)
function splitMessage(text, maxLen = 4096) {
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
  const { phoneNumberId, token } = getConfig();
  const toPhone = normalizePhone(to);
  const chunks = splitMessage(body);

  for (let i = 0; i < chunks.length; i++) {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toPhone,
          type: 'text',
          text: { body: chunks[i], preview_url: false },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`[whatsapp] Error enviando a ${to}:`, err);
      throw new Error(`Meta API error ${res.status}: ${err}`);
    }

    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

// Manda un mensaje con media (imagen, PDF, etc.) via URL pública
async function sendMediaMessage(to, body, mediaUrl) {
  const { phoneNumberId, token } = getConfig();
  const toPhone = normalizePhone(to);

  // Detectar tipo de medio por extensión
  const url = Array.isArray(mediaUrl) ? mediaUrl[0] : mediaUrl;
  const ext = url.split('.').pop().toLowerCase().split('?')[0];
  const typeMap = {
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
    pdf: 'document', doc: 'document', docx: 'document',
    mp4: 'video', mp3: 'audio', ogg: 'audio',
  };
  const mediaType = typeMap[ext] || 'document';

  const payload = {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: mediaType,
    [mediaType]: { link: url },
  };
  if (body) payload[mediaType].caption = body;

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`[whatsapp] Error enviando media a ${to}:`, err);
    throw new Error(`Meta API error ${res.status}: ${err}`);
  }
}

module.exports = { sendMessage, sendMediaMessage };
