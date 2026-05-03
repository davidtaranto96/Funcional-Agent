// WhatsApp via Baileys (no Twilio, no Meta Cloud API)
//
// Reemplaza al cliente Twilio. Mantiene los exports `sendMessage` y `sendMediaMessage`
// con la misma interfaz para no tocar index.js / orchestrator.js / agent.js.
//
// Adicionalmente expone `startWhatsApp(onMessage)` que abre la conexión, persiste
// las credenciales en `data/baileys-auth/` y reenvía cada mensaje entrante al handler.
//
// Primer arranque: vas a ver un QR en los logs. Escanealo desde tu WhatsApp del cel
// (Configuración → Dispositivos vinculados → Vincular un dispositivo). Después queda
// loggeado para siempre — los reconnects son automáticos.

const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys');

// Path donde Baileys persiste credenciales. Override por env (BAILEYS_AUTH_DIR)
// si el default no es escribible (ej. volume root-owned en Railway).
const AUTH_DIR = process.env.BAILEYS_AUTH_DIR
  ? path.resolve(process.env.BAILEYS_AUTH_DIR)
  : path.resolve(__dirname, '..', 'data', 'baileys-auth');
const logger = pino({ level: 'warn' }); // baileys es ruidoso por default

let sock = null;
let connecting = false;
let lastConnectedAt = null;

// ── Helpers de formato de teléfono ────────────────────────────────────────────
// Baileys usa JID: "5493878599185@s.whatsapp.net" (sin '+', sin 'whatsapp:')
// Nuestra DB usa: "whatsapp:+5493878599185"
// Mantenemos la DB key como fuente de verdad y convertimos en los bordes.

function dbKeyToJid(key) {
  // "whatsapp:+5493878599185" → "5493878599185@s.whatsapp.net"
  const digits = String(key || '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `${digits}@s.whatsapp.net`;
}

function jidToDbKey(jid) {
  // "5493878599185@s.whatsapp.net" → "whatsapp:+5493878599185"
  if (!jid) return null;
  const digits = String(jid).split('@')[0].replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `whatsapp:+${digits}`;
}

// Acepta cualquier formato y devuelve la db key canonica
function normalizePhone(phone) {
  if (!phone) return null;
  if (phone.includes('@s.whatsapp.net')) return jidToDbKey(phone);
  if (phone.startsWith('whatsapp:+')) return phone;
  if (phone.startsWith('whatsapp:')) return `whatsapp:+${phone.slice(9).replace(/[^0-9]/g, '')}`;
  const digits = phone.replace(/[^0-9]/g, '');
  return digits ? `whatsapp:+${digits}` : null;
}

// ── Split de mensajes largos ──────────────────────────────────────────────────
function splitMessage(text, maxLen = 4000) {
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

// ── API publica (compat con la version Twilio) ───────────────────────────────

async function sendMessage(to, body) {
  if (!sock) {
    console.error('[whatsapp] sendMessage llamado sin conexión activa');
    return;
  }
  const jid = dbKeyToJid(to);
  if (!jid) {
    console.error(`[whatsapp] No pude parsear destinatario: ${to}`);
    return;
  }
  const chunks = splitMessage(body);
  for (let i = 0; i < chunks.length; i++) {
    try {
      await sock.sendMessage(jid, { text: chunks[i] });
    } catch (err) {
      console.error(`[whatsapp] Error enviando chunk ${i + 1}/${chunks.length}:`, err.message);
      throw err;
    }
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 350));
  }
}

// Envío de media — soporta URL pública (la descarga) o ruta local
async function sendMediaMessage(to, body, mediaUrlOrPath) {
  if (!sock) {
    console.error('[whatsapp] sendMediaMessage llamado sin conexión activa');
    return;
  }
  const jid = dbKeyToJid(to);
  if (!jid) {
    console.error(`[whatsapp] No pude parsear destinatario: ${to}`);
    return;
  }
  const url = Array.isArray(mediaUrlOrPath) ? mediaUrlOrPath[0] : mediaUrlOrPath;

  let buffer;
  if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} descargando media`);
    buffer = Buffer.from(await res.arrayBuffer());
  } else if (typeof url === 'string') {
    buffer = fs.readFileSync(url);
  } else {
    throw new Error('mediaUrl debe ser string (URL o path)');
  }

  const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
  const isVideo = ['mp4', 'mov', 'webm'].includes(ext);
  const isAudio = ['mp3', 'ogg', 'opus', 'm4a', 'wav'].includes(ext);

  if (isImage) {
    await sock.sendMessage(jid, { image: buffer, caption: body || '' });
  } else if (isVideo) {
    await sock.sendMessage(jid, { video: buffer, caption: body || '' });
  } else if (isAudio) {
    await sock.sendMessage(jid, { audio: buffer, mimetype: `audio/${ext === 'opus' ? 'ogg; codecs=opus' : ext}` });
    if (body) await sock.sendMessage(jid, { text: body });
  } else {
    // Documentos (PDF, etc.)
    const fileName = path.basename(url.split('?')[0]) || 'archivo';
    await sock.sendMessage(jid, { document: buffer, fileName, mimetype: 'application/octet-stream' });
    if (body) await sock.sendMessage(jid, { text: body });
  }
}

// ── Lifecycle: conectar a WhatsApp y registrar handler ───────────────────────

// Asegura un dir escribible para Baileys auth state. Si el path preferido falla
// con EACCES (volume root-owned), prueba fallbacks en orden:
//   1) AUTH_DIR (env override o default data/baileys-auth)
//   2) /tmp/baileys-auth (siempre escribible, pero no persiste entre restarts)
function ensureAuthDir() {
  const candidates = [AUTH_DIR, path.join(require('os').tmpdir(), 'baileys-auth')];
  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      // Test de escritura real
      const testFile = path.join(dir, '.write-test');
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      if (dir !== AUTH_DIR) {
        console.warn(`[whatsapp] ⚠️ AUTH_DIR (${AUTH_DIR}) no escribible. Usando fallback: ${dir}`);
        console.warn('[whatsapp] ⚠️ Las credenciales NO van a persistir entre reinicios. Vas a tener que reescanear el QR.');
      }
      return dir;
    } catch (err) {
      console.warn(`[whatsapp] No pude usar ${dir}: ${err.code || err.message}`);
    }
  }
  throw new Error('Ningun directorio escribible disponible para Baileys auth state');
}

async function startWhatsApp(onIncomingMessage) {
  if (connecting || sock) return;
  connecting = true;

  const authDir = ensureAuthDir();
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false, // lo pintamos nosotros para mejor formato
    browser: ['WPanalista', 'Chrome', '1.0'],
    markOnlineOnConnect: true,
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n┌─────────────────────────────────────────────────────────┐');
      console.log('│  WHATSAPP NO CONECTADO — escaneá este QR desde tu cel  │');
      console.log('│  WhatsApp → Config → Dispositivos vinculados →         │');
      console.log('│  Vincular un dispositivo → escanear QR                 │');
      console.log('└─────────────────────────────────────────────────────────┘\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      lastConnectedAt = new Date();
      connecting = false;
      console.log(`[whatsapp] ✅ Conectado a WhatsApp como ${sock.user?.id || '?'} a las ${lastConnectedAt.toISOString()}`);
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.warn(`[whatsapp] ⚠️ Conexión cerrada (code=${code}, reconnect=${shouldReconnect})`);
      sock = null;
      connecting = false;
      if (shouldReconnect) {
        setTimeout(() => startWhatsApp(onIncomingMessage).catch(err => {
          console.error('[whatsapp] Error en reconexión:', err.message);
        }), 3000);
      } else {
        console.error('[whatsapp] ❌ Sesión inválida (loggedOut). Borrá data/baileys-auth/ y reescaneá el QR.');
      }
    }
  });

  // Mensajes entrantes
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      try {
        // Ignorar mensajes que enviamos nosotros mismos
        if (m.key.fromMe) continue;
        // Solo mensajes 1:1 (saltamos grupos por ahora — fácil de habilitar después)
        if (m.key.remoteJid?.endsWith('@g.us')) continue;
        if (!m.key.remoteJid?.endsWith('@s.whatsapp.net')) continue;

        const fromKey = jidToDbKey(m.key.remoteJid);
        if (!fromKey) continue;

        const msg = m.message || {};
        // Texto: puede venir en conversation, extendedTextMessage, o caption de media
        const text = msg.conversation
          || msg.extendedTextMessage?.text
          || msg.imageMessage?.caption
          || msg.videoMessage?.caption
          || msg.documentMessage?.caption
          || '';

        // Audio: descargar buffer y mandarlo al handler
        let audioBuffer = null;
        let audioMime = null;
        if (msg.audioMessage) {
          try {
            audioBuffer = await downloadMediaMessage(m, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage });
            audioMime = msg.audioMessage.mimetype || 'audio/ogg';
          } catch (err) {
            console.error('[whatsapp] Error descargando audio:', err.message);
          }
        }

        // Detectar otros media (imagen/video/sticker/document) sin texto
        const otherMedia = !audioBuffer && !text && (msg.imageMessage || msg.videoMessage || msg.stickerMessage || msg.documentMessage);

        await onIncomingMessage({
          fromKey,
          fromJid: m.key.remoteJid,
          text: text || '',
          audioBuffer,
          audioMime,
          hasMedia: !!otherMedia,
          rawMessage: m,
        });
      } catch (err) {
        console.error('[whatsapp] Error procesando mensaje entrante:', err.message);
      }
    }
  });
}

function getStatus() {
  return {
    connected: !!sock,
    user: sock?.user?.id || null,
    lastConnectedAt: lastConnectedAt?.toISOString() || null,
    authDirExists: fs.existsSync(AUTH_DIR),
  };
}

module.exports = {
  // API publica (compat Twilio)
  sendMessage,
  sendMediaMessage,
  // Nuevo: lifecycle
  startWhatsApp,
  getStatus,
  // Helpers
  normalizePhone,
  jidToDbKey,
  dbKeyToJid,
};
