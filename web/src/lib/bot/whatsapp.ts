// @ts-nocheck
// WhatsApp via Baileys
import path from 'path';
import fs from 'fs';
import os from 'os';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';

// Path resolution robusto: usa resolveDataDir() que prueba varios candidates
// y elige el primero escribible.
import { resolveDataDir } from './data-dir';
function resolveAuthDir(): string {
  if (process.env.BAILEYS_AUTH_DIR) return path.resolve(process.env.BAILEYS_AUTH_DIR);
  return path.join(resolveDataDir(), 'baileys-auth');
}
let _authDir: string | null = null;
function getAuthDir(): string {
  if (!_authDir) _authDir = resolveAuthDir();
  return _authDir;
}
const logger = pino({ level: 'warn' });

let sock: any = null;
let connecting = false;
let lastConnectedAt: Date | null = null;
let consecutive405 = 0;

// Latest QR string emitido por Baileys — expuesto via /api/auth/whatsapp-qr
// para que se pueda escanear desde el browser sin tener que mirar logs ASCII.
//
// IMPORTANTE: lo persistimos en globalThis y NO en variables module-scope.
// Razon: en Next.js 15 con webpack/turbopack, instrumentation.ts y la API
// route pueden cargar el modulo en bundles separados, dejando dos instancias
// de las variables. globalThis es compartido entre todas. Mismo trick que
// usamos para __wpBotStarted en instrumentation.ts.
type QRGlobal = {
  __wpQR?: string | null;
  __wpQRAt?: Date | null;
  __wpConnected?: boolean;
  __wpUser?: string | null;
  __wpLastConnectedAt?: Date | null;
};
function qrGlobal(): QRGlobal {
  return globalThis as unknown as QRGlobal;
}
function setLatestQR(qr: string | null): void {
  const g = qrGlobal();
  g.__wpQR = qr;
  g.__wpQRAt = qr ? new Date() : null;
}
function setConnected(connected: boolean, user: string | null = null): void {
  const g = qrGlobal();
  g.__wpConnected = connected;
  g.__wpUser = user;
  if (connected) g.__wpLastConnectedAt = new Date();
}

function dbKeyToJid(key: string): string | null {
  const digits = String(key || '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `${digits}@s.whatsapp.net`;
}

function jidToDbKey(jid: string): string | null {
  if (!jid) return null;
  const digits = String(jid).split('@')[0].replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `whatsapp:+${digits}`;
}

export function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  if (phone.includes('@s.whatsapp.net')) return jidToDbKey(phone);
  if (phone.startsWith('whatsapp:+')) return phone;
  if (phone.startsWith('whatsapp:')) return `whatsapp:+${phone.slice(9).replace(/[^0-9]/g, '')}`;
  const digits = phone.replace(/[^0-9]/g, '');
  return digits ? `whatsapp:+${digits}` : null;
}

function splitMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
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

export async function sendMessage(to: string, body: string): Promise<void> {
  if (!sock) { console.error('[whatsapp] sendMessage llamado sin conexión activa'); return; }
  const jid = dbKeyToJid(to);
  if (!jid) { console.error(`[whatsapp] No pude parsear destinatario: ${to}`); return; }
  const chunks = splitMessage(body);
  for (let i = 0; i < chunks.length; i++) {
    try {
      await sock.sendMessage(jid, { text: chunks[i] });
    } catch (err: any) {
      console.error(`[whatsapp] Error enviando chunk ${i + 1}/${chunks.length}:`, err.message);
      throw err;
    }
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 350));
  }
}

export async function sendMediaMessage(to: string, body: string, mediaUrlOrPath: string | string[]): Promise<void> {
  if (!sock) { console.error('[whatsapp] sendMediaMessage sin conexión'); return; }
  const jid = dbKeyToJid(to);
  if (!jid) return;
  const url = Array.isArray(mediaUrlOrPath) ? mediaUrlOrPath[0] : mediaUrlOrPath;

  let buffer: Buffer;
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
    const fileName = path.basename(url.split('?')[0]) || 'archivo';
    await sock.sendMessage(jid, { document: buffer, fileName, mimetype: 'application/octet-stream' });
    if (body) await sock.sendMessage(jid, { text: body });
  }
}

function ensureAuthDir(): string {
  const candidates = [getAuthDir(), path.join(os.tmpdir(), 'baileys-auth')];
  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const testFile = path.join(dir, '.write-test');
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      if (dir !== getAuthDir()) {
        console.warn(`[whatsapp] ⚠️ getAuthDir() (${getAuthDir()}) no escribible. Usando fallback: ${dir}`);
        console.warn('[whatsapp] ⚠️ Las credenciales NO van a persistir entre reinicios.');
      }
      return dir;
    } catch (err: any) {
      console.warn(`[whatsapp] No pude usar ${dir}: ${err.code || err.message}`);
    }
  }
  throw new Error('Ningun directorio escribible disponible para Baileys auth state');
}

function clearAuthDir(dir: string): void {
  try {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      try { fs.unlinkSync(path.join(dir, f)); } catch { /* skip */ }
    }
    console.warn(`[whatsapp] 🧹 Auth state limpiado en ${dir}`);
  } catch (err: any) {
    console.error('[whatsapp] Error limpiando auth dir:', err.message);
  }
}

export type IncomingMessage = {
  fromKey: string;
  fromJid: string;
  text: string;
  audioBuffer: Buffer | null;
  audioMime: string | null;
  hasMedia: boolean;
  rawMessage: any;
};

export async function startWhatsApp(onIncomingMessage: (msg: IncomingMessage) => Promise<void>): Promise<void> {
  if (connecting || sock) return;
  connecting = true;

  const authDir = ensureAuthDir();

  if (process.env.BAILEYS_RESET === '1') {
    console.warn('[whatsapp] BAILEYS_RESET=1 — limpiando auth state ANTES de conectar');
    clearAuthDir(authDir);
  }

  if (consecutive405 >= 2) {
    console.warn(`[whatsapp] ${consecutive405} codigos 405 consecutivos — limpiando auth state`);
    clearAuthDir(authDir);
    consecutive405 = 0;
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  let version: number[] | undefined;
  try {
    const fetched = await fetchLatestBaileysVersion();
    version = fetched.version;
    console.log(`[whatsapp] WA Web version: ${version.join('.')} (isLatest: ${fetched.isLatest})`);
  } catch (err: any) {
    console.warn('[whatsapp] No pude fetchear version, default Baileys:', err.message);
  }

  sock = makeWASocket({
    auth: state,
    logger,
    version,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: true,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update: any) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      consecutive405 = 0;
      setLatestQR(qr);
      console.log('\n┌─────────────────────────────────────────────────────────┐');
      console.log('│  WHATSAPP NO CONECTADO — escaneá QR desde el cel        │');
      console.log('│  Opcion 1: en logs (abajo) — bajá zoom del browser     │');
      console.log('│  Opcion 2: visitá /api/auth/whatsapp-qr (PNG fácil)     │');
      console.log('└─────────────────────────────────────────────────────────┘\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      lastConnectedAt = new Date();
      connecting = false;
      consecutive405 = 0;
      setLatestQR(null); // ya no se necesita
      setConnected(true, sock.user?.id || null);
      console.log(`[whatsapp] ✅ Conectado como ${sock.user?.id || '?'} a las ${lastConnectedAt.toISOString()}`);
    }
    if (connection === 'close') {
      const err = lastDisconnect?.error;
      const code = err?.output?.statusCode;
      const errMsg = err?.message || err?.data?.reason || 'unknown';
      const errData = err?.data ? JSON.stringify(err.data).slice(0, 200) : '';
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      if (code === 405) consecutive405++;
      setConnected(false);
      console.warn(`[whatsapp] ⚠️ Cerrada (code=${code}, msg="${errMsg}", reconnect=${shouldReconnect}, 405streak=${consecutive405})`);
      if (errData) console.warn(`[whatsapp]   error.data: ${errData}`);
      sock = null;
      connecting = false;
      if (shouldReconnect) {
        const delay = Math.min(15000, 3000 + consecutive405 * 2000);
        setTimeout(() => startWhatsApp(onIncomingMessage).catch(err => {
          console.error('[whatsapp] Error reconexión:', err.message);
        }), delay);
      } else {
        console.error('[whatsapp] ❌ Sesión inválida (loggedOut). Setea BAILEYS_RESET=1 y redeploya.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      try {
        if (m.key.fromMe) continue;
        if (m.key.remoteJid?.endsWith('@g.us')) continue;
        if (!m.key.remoteJid?.endsWith('@s.whatsapp.net')) continue;

        const fromKey = jidToDbKey(m.key.remoteJid);
        if (!fromKey) continue;

        const msg = m.message || {};
        const text = msg.conversation
          || msg.extendedTextMessage?.text
          || msg.imageMessage?.caption
          || msg.videoMessage?.caption
          || msg.documentMessage?.caption
          || '';

        let audioBuffer: Buffer | null = null;
        let audioMime: string | null = null;
        if (msg.audioMessage) {
          try {
            audioBuffer = await downloadMediaMessage(m, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage });
            audioMime = msg.audioMessage.mimetype || 'audio/ogg';
          } catch (err: any) {
            console.error('[whatsapp] Error descargando audio:', err.message);
          }
        }

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
      } catch (err: any) {
        console.error('[whatsapp] Error procesando mensaje entrante:', err.message);
      }
    }
  });
}

export function getStatus() {
  const g = qrGlobal();
  // sock es module-scoped y solo existe en la instance que arranco el bot.
  // connected/user/lastConnectedAt los leemos de globalThis para que
  // cualquier API route los vea aunque corra en otra instance.
  return {
    connected: !!g.__wpConnected,
    user: g.__wpUser || null,
    lastConnectedAt: g.__wpLastConnectedAt?.toISOString() || null,
    authDirExists: fs.existsSync(getAuthDir()),
    qrAvailable: !!g.__wpQR,
    qrAt: g.__wpQRAt?.toISOString() || null,
  };
}

export function getLatestQR(): { qr: string | null; at: Date | null } {
  const g = qrGlobal();
  return { qr: g.__wpQR || null, at: g.__wpQRAt || null };
}
