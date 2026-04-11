const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const os = require('os');

let groqClient;
function getClient() {
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
}

// Twilio: recibe la URL directa del audio (con auth básica Account SID + Auth Token)
// y transcribe con Groq Whisper (gratis)
async function transcribe(mediaUrl) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN no configurados');

    // Descargar el audio con Basic Auth de Twilio
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const audioRes = await fetch(mediaUrl, {
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (!audioRes.ok) throw new Error(`Error descargando audio de Twilio: ${audioRes.status}`);
    const buffer = Buffer.from(await audioRes.arrayBuffer());

    // Guardar temporalmente y transcribir
    const tmpFile = path.join(os.tmpdir(), `wa_audio_${Date.now()}.ogg`);
    fs.writeFileSync(tmpFile, buffer);

    try {
      const result = await getClient().audio.transcriptions.create({
        file: fs.createReadStream(tmpFile),
        model: 'whisper-large-v3',
        language: 'es',
      });
      return result.text;
    } finally {
      fs.unlink(tmpFile, () => {});
    }
  } catch (err) {
    console.error('Error transcribiendo audio:', err.message);
    return '[No pude entender el audio, ¿podrías escribirlo?]';
  }
}

module.exports = { transcribe };
