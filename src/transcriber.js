const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const os = require('os');

let groqClient;
function getClient() {
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
}

// Meta Cloud API: recibe un media_id, resuelve la URL de descarga y transcribe con Groq Whisper (gratis)
async function transcribe(mediaId) {
  try {
    const token = process.env.META_ACCESS_TOKEN;
    if (!token) throw new Error('META_ACCESS_TOKEN no configurado');

    // Paso 1: obtener la URL de descarga del audio
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!metaRes.ok) throw new Error(`Meta media error ${metaRes.status}: ${await metaRes.text()}`);
    const { url: downloadUrl } = await metaRes.json();
    if (!downloadUrl) throw new Error('Meta no devolvió URL de descarga');

    // Paso 2: descargar el archivo de audio con el Bearer token
    const audioRes = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!audioRes.ok) throw new Error(`Audio download failed: ${audioRes.status}`);
    const buffer = Buffer.from(await audioRes.arrayBuffer());

    // Paso 3: transcribir con Groq Whisper large-v3 (gratis)
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
