import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import os from 'os';

let groqClient: Groq | null = null;

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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms)),
  ]);
}

function isTwilioMediaUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    return host === 'twilio.com' || host.endsWith('.twilio.com');
  } catch {
    return false;
  }
}

export async function transcribe(mediaUrl: string): Promise<string> {
  try {
    const client = getClient();
    if (!client) return '[No pude procesar el audio en este momento]';

    if (!isTwilioMediaUrl(mediaUrl)) {
      console.error(`[transcriber] mediaUrl rechazada: ${(mediaUrl || '').substring(0, 80)}`);
      return '[No pude procesar el audio en este momento]';
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      console.error('[transcriber] TWILIO creds missing');
      return '[No pude procesar el audio en este momento]';
    }

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    let audioRes = await withTimeout(
      fetch(mediaUrl, {
        headers: { Authorization: `Basic ${credentials}` },
        redirect: 'manual',
      }),
      10000,
      'descarga audio Twilio'
    );

    // Twilio responde con redirect a S3 — seguir SIN credentials
    if (audioRes.status >= 300 && audioRes.status < 400) {
      const location = audioRes.headers.get('location');
      if (!location) return '[No pude descargar el audio, ¿podrías escribirlo?]';
      audioRes = await withTimeout(fetch(location, { redirect: 'follow' }), 10000, 'descarga audio (redirect)');
    }

    if (!audioRes.ok) {
      console.error(`[transcriber] HTTP error: ${audioRes.status}`);
      return '[No pude descargar el audio, ¿podrías escribirlo?]';
    }

    const contentType = audioRes.headers.get('content-type') || '';
    const buffer = Buffer.from(await audioRes.arrayBuffer());
    if (buffer.length < 100) return '[El audio parece estar vacío, ¿podrías grabarlo de nuevo?]';

    const ext = contentType.includes('ogg') ? '.ogg'
      : contentType.includes('opus') ? '.opus'
      : contentType.includes('mp4') || contentType.includes('m4a') ? '.m4a'
      : contentType.includes('mpeg') || contentType.includes('mp3') ? '.mp3'
      : contentType.includes('webm') ? '.webm'
      : contentType.includes('amr') ? '.amr'
      : '.ogg';

    const tmpFile = path.join(os.tmpdir(), `wa_audio_${Date.now()}${ext}`);
    fs.writeFileSync(tmpFile, buffer);

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
      return text || '[No pude entender el audio, ¿podrías escribirlo?]';
    } finally {
      fs.unlink(tmpFile, () => {});
    }
  } catch (err) {
    const e = err as Error;
    console.error('[transcriber]', e.message);
    if (e.message.includes('Timeout')) return '[El audio tardó mucho, ¿podrías escribirlo?]';
    return '[No pude entender el audio, ¿podrías escribirlo?]';
  }
}

export async function transcribeBuffer(buf: Buffer, ext = '.webm'): Promise<string> {
  const client = getClient();
  if (!client) return '';
  const tmpFile = path.join(os.tmpdir(), `admin_audio_${Date.now()}${ext}`);
  fs.writeFileSync(tmpFile, buf);
  try {
    const result = await client.audio.transcriptions.create({
      file: fs.createReadStream(tmpFile),
      model: 'whisper-large-v3',
      language: 'es',
    });
    return (result.text || '').trim();
  } finally {
    fs.unlink(tmpFile, () => {});
  }
}
