const OpenAI = require('openai');
const { toFile } = require('openai');

// Lazy init para que no explote al importar sin API key
let openai;
function getClient() {
  if (!openai) openai = new OpenAI();
  return openai;
}

// Meta Cloud API: recibe un media_id, resuelve la URL de descarga y transcribe con Whisper
async function transcribe(mediaId) {
  try {
    const token = process.env.META_ACCESS_TOKEN;
    if (!token) throw new Error('META_ACCESS_TOKEN no configurado');

    // Paso 1: obtener la URL de descarga del audio
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!metaRes.ok) {
      const errText = await metaRes.text();
      throw new Error(`Meta media info error ${metaRes.status}: ${errText}`);
    }
    const metaData = await metaRes.json();
    const downloadUrl = metaData.url;
    if (!downloadUrl) throw new Error('Meta no devolvió URL de descarga');

    // Paso 2: descargar el archivo de audio con el Bearer token
    const audioRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!audioRes.ok) {
      throw new Error(`Audio download failed: ${audioRes.status}`);
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Paso 3: transcribir con Whisper
    // Meta suele mandar audio/ogg o audio/mpeg; Whisper acepta ambos
    const transcription = await getClient().audio.transcriptions.create({
      file: await toFile(buffer, 'audio.ogg', { type: 'audio/ogg' }),
      model: 'whisper-1',
      language: 'es', // Forzar español para evitar que detecte portugués
    });

    return transcription.text;
  } catch (err) {
    console.error('Error transcribiendo audio:', err.message);
    return '[No pude entender el audio, ¿podrías escribirlo?]';
  }
}

module.exports = { transcribe };
