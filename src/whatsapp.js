const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Parte un mensaje largo en chunks respetando saltos de línea
function splitMessage(text, maxLen = 1500) {
  if (text.length <= maxLen) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    // Buscar el último salto de párrafo dentro del límite
    let splitAt = remaining.lastIndexOf('\n\n', maxLen);
    if (splitAt === -1 || splitAt < maxLen * 0.3) {
      // Si no hay párrafo, buscar salto de línea
      splitAt = remaining.lastIndexOf('\n', maxLen);
    }
    if (splitAt === -1 || splitAt < maxLen * 0.3) {
      // Último recurso: cortar en el último espacio
      splitAt = remaining.lastIndexOf(' ', maxLen);
    }
    if (splitAt === -1) splitAt = maxLen;

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

async function sendMessage(to, body) {
  const chunks = splitMessage(body);

  for (let i = 0; i < chunks.length; i++) {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to,
      body: chunks[i],
    });
    // Pequeña pausa entre chunks para mantener el orden
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
}

module.exports = { sendMessage };
