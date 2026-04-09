const OpenAI = require('openai');
const { toFile } = require('openai');

// Lazy init para que no explote al importar sin API key
let openai;
function getClient() {
  if (!openai) openai = new OpenAI();
  return openai;
}

// Descarga el audio de Twilio (requiere auth) y lo transcribe con Whisper
async function transcribe(mediaUrl) {
  try {
    // Twilio media URLs requieren Basic Auth con SID:Token
    const credentials = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString('base64');

    const response = await fetch(mediaUrl, {
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (!response.ok) {
      throw new Error(`Twilio media download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const transcription = await getClient().audio.transcriptions.create({
      file: await toFile(buffer, 'audio.ogg'),
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
