const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const os = require('os');

let groqClient;
function getClient() {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error('[transcriber] GROQ_API_KEY no configurada');
      return null;
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

// Timeout helper
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms)),
  ]);
}

// Twilio: recibe la URL directa del audio (con auth básica Account SID + Auth Token)
// y transcribe con Groq Whisper (gratis)
async function transcribe(mediaUrl) {
  try {
    const client = getClient();
    if (!client) return '[No pude procesar el audio en este momento]';

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.error('[transcriber] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN no configurados');
      return '[No pude procesar el audio en este momento]';
    }

    // Descargar el audio con Basic Auth de Twilio (timeout 10s)
    console.log(`[transcriber] Descargando audio: ${mediaUrl.substring(0, 80)}...`);
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const audioRes = await withTimeout(
      fetch(mediaUrl, {
        headers: { Authorization: `Basic ${credentials}` },
        redirect: 'follow',
      }),
      10000,
      'descarga audio Twilio'
    );

    if (!audioRes.ok) {
      console.error(`[transcriber] Error HTTP descargando audio: ${audioRes.status} ${audioRes.statusText}`);
      return '[No pude descargar el audio, ¿podrías escribirlo?]';
    }

    const contentType = audioRes.headers.get('content-type') || '';
    console.log(`[transcriber] Audio descargado, content-type: ${contentType}`);

    const buffer = Buffer.from(await audioRes.arrayBuffer());
    console.log(`[transcriber] Audio size: ${buffer.length} bytes`);

    if (buffer.length < 100) {
      console.error('[transcriber] Audio demasiado pequeño, posiblemente corrupto');
      return '[El audio parece estar vacío, ¿podrías grabarlo de nuevo?]';
    }

    // Detectar extensión según content-type
    const ext = contentType.includes('ogg') ? '.ogg'
      : contentType.includes('opus') ? '.opus'
      : contentType.includes('mp4') || contentType.includes('m4a') ? '.m4a'
      : contentType.includes('mpeg') || contentType.includes('mp3') ? '.mp3'
      : contentType.includes('webm') ? '.webm'
      : contentType.includes('amr') ? '.amr'
      : '.ogg'; // default para WhatsApp

    // Guardar temporalmente y transcribir
    const tmpFile = path.join(os.tmpdir(), `wa_audio_${Date.now()}${ext}`);
    fs.writeFileSync(tmpFile, buffer);
    console.log(`[transcriber] Archivo temporal: ${tmpFile}`);

    try {
      const result = await withTimeout(
        client.audio.transcriptions.create({
          file: fs.createReadStream(tmpFile),
          model: 'whisper-large-v3',
          language: 'es',
        }),
        12000,
        'transcripción Groq Whisper'
      );

      const text = (result.text || '').trim();
      console.log(`[transcriber] Transcripción exitosa: "${text.substring(0, 100)}"`);

      if (!text) {
        return '[No pude entender el audio, ¿podrías escribirlo?]';
      }

      return text;
    } finally {
      fs.unlink(tmpFile, () => {});
    }
  } catch (err) {
    console.error('[transcriber] Error transcribiendo audio:', err.message);
    if (err.message.includes('Timeout')) {
      return '[El audio tardó mucho en procesarse, ¿podrías escribirlo?]';
    }
    return '[No pude entender el audio, ¿podrías escribirlo?]';
  }
}

module.exports = { transcribe };
