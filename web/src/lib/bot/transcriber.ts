// @ts-nocheck
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import os from 'os';

let groqClient: Groq | null = null;
function getClient(): Groq | null {
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

// Transcribe audio con Groq Whisper. Solo soporta Buffer (Baileys).
export async function transcribe(input: Buffer, opts: { mime?: string } = {}): Promise<string> {
  const client = getClient();
  if (!client) return '[No pude procesar el audio en este momento]';
  return await transcribeBuffer(client, input, opts.mime || 'audio/ogg');
}

async function transcribeBuffer(client: Groq, buffer: Buffer, mime: string): Promise<string> {
  if (!buffer || buffer.length < 100) {
    return '[El audio parece estar vacío, ¿podrías grabarlo de nuevo?]';
  }
  const ext = mime.includes('opus') ? '.opus'
    : mime.includes('ogg') ? '.ogg'
    : mime.includes('mp4') || mime.includes('m4a') ? '.m4a'
    : mime.includes('mpeg') || mime.includes('mp3') ? '.mp3'
    : mime.includes('webm') ? '.webm'
    : mime.includes('amr') ? '.amr'
    : mime.includes('wav') ? '.wav'
    : '.ogg';

  const tmpFile = path.join(os.tmpdir(), `wa_audio_${Date.now()}${ext}`);
  fs.writeFileSync(tmpFile, buffer);
  console.log(`[transcriber] Audio buffer (${buffer.length}b, ${mime}) -> ${tmpFile}`);
  try {
    const result: any = await withTimeout(
      client.audio.transcriptions.create({
        file: fs.createReadStream(tmpFile) as any,
        model: 'whisper-large-v3',
        language: 'es',
      }),
      12000,
      'transcripción Groq Whisper'
    );
    const text = (result.text || '').trim();
    console.log(`[transcriber] Transcripción exitosa: "${text.substring(0, 100)}"`);
    if (!text) return '[No pude entender el audio, ¿podrías escribirlo?]';
    return text;
  } catch (err: any) {
    console.error('[transcriber] Error transcribiendo buffer:', err.message);
    if (err.message?.includes('Timeout')) return '[El audio tardó mucho en procesarse, ¿podrías escribirlo?]';
    return '[No pude entender el audio, ¿podrías escribirlo?]';
  } finally {
    fs.unlink(tmpFile, () => {});
  }
}
