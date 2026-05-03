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

// Validar que mediaUrl sea efectivamente de Twilio antes de filtrarle creds
function isTwilioMediaUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    // api.twilio.com, mcs.us1.twilio.com, etc. — siempre subdominios de twilio.com
    return host === 'twilio.com' || host.endsWith('.twilio.com');
  } catch {
    return false;
  }
}

// Twilio: recibe la URL directa del audio (con auth básica Account SID + Auth Token)
// y transcribe con Groq Whisper (gratis)
async function transcribe(mediaUrl) {
  try {
    const client = getClient();
    if (!client) return '[No pude procesar el audio en este momento]';

    if (!isTwilioMediaUrl(mediaUrl)) {
      console.error(`[transcriber] mediaUrl rechazada por allowlist: ${(mediaUrl||'').substring(0,80)}`);
      return '[No pude procesar el audio en este momento]';
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.error('[transcriber] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN no configurados');
      return '[No pude procesar el audio en este momento]';
    }

    // Descargar el audio con Basic Auth de Twilio (timeout 10s)
    // redirect: 'manual' — defensa en profundidad: si Twilio responde con 30x, no seguimos a un dominio externo
    console.log(`[transcriber] Descargando audio: ${mediaUrl.substring(0, 80)}...`);
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const audioRes = await withTimeout(
      fetch(mediaUrl, {
        headers: { Authorization: `Basic ${credentials}` },
        redirect: 'manual',
      }),
      10000,
      'descarga audio Twilio'
    );

    // Twilio sirve audios via redirect 307 a un bucket S3. Hay que seguirlo manualmente — pero SIN el Authorization header.
    if (audioRes.status >= 300 && audioRes.status < 400) {
      const location = audioRes.headers.get('location');
      if (!location) {
        console.error('[transcriber] Redirect sin Location');
        return '[No pude descargar el audio, ¿podrías escribirlo?]';
      }
      console.log(`[transcriber] Siguiendo redirect (sin creds): ${location.substring(0, 80)}...`);
      // Sí permitimos cualquier host acá (es donde Twilio aloja el archivo, típicamente S3) — pero SIN auth header.
      const followRes = await withTimeout(
        fetch(location, { redirect: 'follow' }),
        10000,
        'descarga audio (redirect)'
      );
      if (!followRes.ok) {
        console.error(`[transcriber] Error HTTP en redirect: ${followRes.status}`);
        return '[No pude descargar el audio, ¿podrías escribirlo?]';
      }
      // Reasignar a audioRes para que el resto del código funcione
      var redirectedAudioRes = followRes;
      Object.defineProperty(audioRes, 'ok', { value: followRes.ok, writable: true });
      Object.defineProperty(audioRes, 'status', { value: followRes.status, writable: true });
      Object.defineProperty(audioRes, 'headers', { value: followRes.headers, writable: true });
      Object.defineProperty(audioRes, 'arrayBuffer', { value: () => followRes.arrayBuffer(), writable: true });
    }

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
