// File API — endpoints REST que exponen el filesystem del volume al servicio
// Next.js (que NO tiene volume montado en Railway).
//
// Auth: header `x-admin-token` con valor de process.env.ADMIN_API_TOKEN
//
// Endpoints:
//   GET  /api/folders/list            → todas las carpetas (custom + project + demo) con file counts
//   GET  /api/folders/files?id=...    → archivos de una carpeta
//   POST /api/folders/delete?id=...   → borra carpeta custom + archivos
//   POST /api/files/upload?id=...     → multipart upload (campo "files")
//   GET  /api/files/get?id=...&name=... → descarga/preview archivo
//   POST /api/files/delete?id=...&name=... → borra archivo
//   POST /api/files/rename?id=...&name=...  body: { newName }
//   POST /api/files/move?id=...&name=...    body: { toFolder }

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');

const router = express.Router();

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DOCS_DIR = path.join(DATA_DIR, 'documents');
const PROJECT_FILES_DIR = path.join(DATA_DIR, 'project-files');
const DEMOS_DIR = path.join(DATA_DIR, 'demos');

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeJoin(base, segment) {
  const resolved = path.resolve(base, segment);
  if (!resolved.startsWith(path.resolve(base))) return null;
  return resolved;
}

function sanitizeFilename(raw) {
  const base = path.basename(raw || 'file');
  const safe = base.replace(/[^a-zA-Z0-9._\-áéíóúÁÉÍÓÚñÑüÜ ]/g, '_');
  if (safe === '..' || safe === '.' || !safe) return `file_${Date.now()}`;
  return safe;
}

function uniqueName(dir, name) {
  if (!fs.existsSync(path.join(dir, name))) return name;
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let i = 2;
  while (fs.existsSync(path.join(dir, `${base} (${i})${ext}`)) && i < 999) i++;
  return `${base} (${i})${ext}`;
}

function countFiles(dir) {
  if (!fs.existsSync(dir)) return { count: 0, bytes: 0 };
  let count = 0; let bytes = 0;
  try {
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('.')) continue;
      const full = path.join(dir, f);
      try {
        const st = fs.statSync(full);
        if (st.isFile()) { count++; bytes += st.size; }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return { count, bytes };
}

function listFolderFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter(f => !f.startsWith('.'))
      .map(name => {
        const full = path.join(dir, name);
        try {
          const stat = fs.statSync(full);
          if (!stat.isFile()) return null;
          return {
            name,
            size: stat.size,
            mtime: stat.mtime.toISOString(),
            ext: path.extname(name).toLowerCase(),
          };
        } catch { return null; }
      })
      .filter(x => x !== null)
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch {
    return [];
  }
}

// Resuelve un id (df_*, pf_*, wd_*) a su info + dir físico
async function resolveFolder(id) {
  if (!id) return null;

  if (id.startsWith('df_') || (!id.startsWith('pf_') && !id.startsWith('wd_'))) {
    const folders = await db.listDocumentFolders();
    const f = folders.find(x => x.id === id);
    if (!f) return null;
    const dir = safeJoin(DOCS_DIR, id);
    if (!dir) return null;
    return { id, type: 'custom', name: f.name, color: f.color, description: f.description, dir, subtitle: f.description || 'Carpeta personal' };
  }

  if (id.startsWith('pf_')) {
    const projectId = id.slice(3);
    const project = await db.getProject(projectId);
    if (!project) return null;
    const dir = safeJoin(PROJECT_FILES_DIR, projectId);
    if (!dir) return null;
    return { id, type: 'project', name: project.title || 'Proyecto sin título', color: '#8b5cf6', description: project.description || '', dir, subtitle: project.client_name ? `Proyecto · ${project.client_name}` : 'Proyecto' };
  }

  if (id.startsWith('wd_')) {
    const phone = id.slice(3);
    const conv = await db.getConversation(phone);
    if (!conv) return null;
    const dir = safeJoin(DEMOS_DIR, phone);
    if (!dir) return null;
    const name = conv.report?.cliente?.nombre || phone;
    return { id, type: 'demo', name, color: '#10b981', description: conv.report?.proyecto?.tipo || '', dir, subtitle: 'Demo WhatsApp' };
  }

  return null;
}

// ── Auth middleware ──────────────────────────────────────────────────────────

function requireToken(req, res, next) {
  const token = req.get('x-admin-token') || req.query.admin_token;
  if (!process.env.ADMIN_API_TOKEN || token !== process.env.ADMIN_API_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

router.use(requireToken);

// ── Multer para uploads ──────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ── ENDPOINTS ────────────────────────────────────────────────────────────────

// GET /api/folders/list — todas las carpetas con file counts
router.get('/folders/list', async (req, res) => {
  try {
    const [folders, projects, conversations] = await Promise.all([
      db.listDocumentFolders(),
      db.listProjects(),
      db.listAllClients(),
    ]);

    const custom = folders.map(f => {
      const dir = safeJoin(DOCS_DIR, f.id) || '';
      const { count, bytes } = dir ? countFiles(dir) : { count: 0, bytes: 0 };
      return {
        id: f.id, type: 'custom', name: f.name, color: f.color,
        subtitle: f.description || 'Carpeta personal',
        fileCount: count, bytes, description: f.description,
        href: `/admin/documentos/${f.id}`,
      };
    });

    const projectFolders = projects.map(p => {
      const dir = safeJoin(PROJECT_FILES_DIR, p.id) || '';
      const { count, bytes } = dir ? countFiles(dir) : { count: 0, bytes: 0 };
      return {
        id: `pf_${p.id}`, type: 'project', name: p.title || 'Sin título',
        color: '#8b5cf6', subtitle: p.client_name || 'Sin cliente',
        fileCount: count, bytes, description: p.description,
        href: `/admin/documentos/pf_${p.id}`,
      };
    });

    const demoFolders = conversations
      .filter(c => c.demo_status === 'sent' || c.demo_status === 'approved' || c.demo_status === 'pending_review')
      .map(c => {
        const dir = safeJoin(DEMOS_DIR, c.phone) || '';
        const { count, bytes } = dir ? countFiles(dir) : { count: 0, bytes: 0 };
        const name = c.report?.cliente?.nombre || c.phone;
        return {
          id: `wd_${c.phone}`, type: 'demo', name, color: '#10b981',
          subtitle: c.report?.proyecto?.tipo || 'Demo WA',
          fileCount: count, bytes,
          href: `/admin/documentos/wd_${c.phone}`,
        };
      });

    const projectsWithFiles = projectFolders.filter(p => p.fileCount > 0);
    const demosWithFiles = demoFolders.filter(d => d.fileCount > 0);
    const allShown = [...custom, ...projectsWithFiles, ...demosWithFiles];
    const totalFiles = allShown.reduce((s, f) => s + f.fileCount, 0);
    const totalBytes = allShown.reduce((s, f) => s + f.bytes, 0);

    res.json({
      custom,
      projects: projectsWithFiles,
      demos: demosWithFiles,
      totalFiles, totalBytes,
    });
  } catch (err) {
    console.error('[file-api] /folders/list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/folders/files?id=... — info de la carpeta + archivos
router.get('/folders/files', async (req, res) => {
  try {
    const id = String(req.query.id || '');
    const folder = await resolveFolder(id);
    if (!folder) return res.status(404).json({ error: 'folder not found' });
    const files = listFolderFiles(folder.dir);
    res.json({ folder: { id: folder.id, name: folder.name, color: folder.color, description: folder.description, type: folder.type, subtitle: folder.subtitle }, files });
  } catch (err) {
    console.error('[file-api] /folders/files error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/folders/delete?id=... — borra custom folder + archivos
router.post('/folders/delete', async (req, res) => {
  try {
    const id = String(req.query.id || '');
    if (id.startsWith('pf_') || id.startsWith('wd_')) {
      return res.status(400).json({ error: 'no se pueden borrar carpetas virtuales (proyectos/demos)' });
    }
    const folder = await resolveFolder(id);
    if (folder && fs.existsSync(folder.dir)) {
      try { fs.rmSync(folder.dir, { recursive: true, force: true }); } catch (e) { console.error(e); }
    }
    await db.deleteDocumentFolder(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[file-api] /folders/delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/folders/create — crea una nueva custom folder
router.post('/folders/create', express.json(), async (req, res) => {
  try {
    const { name, color, description } = req.body || {};
    const id = await db.createDocumentFolder({
      name: name || 'Sin nombre',
      color: color || '#fbbf24',
      description: description || '',
    });
    res.json({ ok: true, id });
  } catch (err) {
    console.error('[file-api] /folders/create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/files/upload?id=... — multipart upload
router.post('/files/upload', upload.array('files', 20), async (req, res) => {
  try {
    const id = String(req.query.id || '');
    const folder = await resolveFolder(id);
    if (!folder) return res.status(404).json({ error: 'folder not found' });

    fs.mkdirSync(folder.dir, { recursive: true });

    let saved = 0;
    const skipped = [];
    const errors = [];
    for (const file of req.files || []) {
      try {
        if (file.size > 50 * 1024 * 1024) { skipped.push(`${file.originalname} (>50MB)`); continue; }
        const filename = uniqueName(folder.dir, sanitizeFilename(file.originalname));
        const fullPath = path.join(folder.dir, filename);
        if (!fullPath.startsWith(folder.dir)) { errors.push(`${file.originalname} (path traversal)`); continue; }
        fs.writeFileSync(fullPath, file.buffer);
        saved++;
      } catch (e) {
        errors.push(`${file.originalname} (${e.code || e.message})`);
      }
    }
    res.json({ saved, skipped, errors });
  } catch (err) {
    console.error('[file-api] /files/upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

const MIME = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json', '.html': 'text/html; charset=utf-8',
  '.zip': 'application/zip', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// GET /api/files/get?id=...&name=... — devuelve el archivo
router.get('/files/get', async (req, res) => {
  try {
    const id = String(req.query.id || '');
    const name = String(req.query.name || '');
    const folder = await resolveFolder(id);
    if (!folder) return res.status(404).json({ error: 'folder not found' });
    const decoded = decodeURIComponent(name);
    const full = safeJoin(folder.dir, decoded);
    if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return res.status(404).json({ error: 'file not found' });
    }
    const ext = path.extname(full).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const buf = fs.readFileSync(full);
    const previewable = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.txt', '.csv', '.html'];
    const disposition = previewable.includes(ext) ? `inline; filename="${encodeURIComponent(decoded)}"` : `attachment; filename="${encodeURIComponent(decoded)}"`;
    res.set('Content-Type', mime);
    res.set('Content-Disposition', disposition);
    res.send(buf);
  } catch (err) {
    console.error('[file-api] /files/get error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/files/delete?id=...&name=...
router.post('/files/delete', async (req, res) => {
  try {
    const id = String(req.query.id || '');
    const name = String(req.query.name || '');
    const folder = await resolveFolder(id);
    if (!folder) return res.status(404).json({ error: 'folder not found' });
    const full = safeJoin(folder.dir, decodeURIComponent(name));
    if (full && fs.existsSync(full)) fs.unlinkSync(full);
    res.json({ ok: true });
  } catch (err) {
    console.error('[file-api] /files/delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/files/rename?id=...&name=...   body: { newName }
router.post('/files/rename', express.json(), async (req, res) => {
  try {
    const id = String(req.query.id || '');
    const name = String(req.query.name || '');
    const newName = String((req.body && req.body.newName) || '').trim();
    if (!newName) return res.status(400).json({ error: 'Nombre vacío' });
    const folder = await resolveFolder(id);
    if (!folder) return res.status(404).json({ error: 'folder not found' });
    const newSafe = sanitizeFilename(newName);
    const oldFull = safeJoin(folder.dir, decodeURIComponent(name));
    const newFull = safeJoin(folder.dir, newSafe);
    if (!oldFull || !newFull) return res.status(400).json({ error: 'Ruta inválida' });
    if (!fs.existsSync(oldFull)) return res.status(404).json({ error: 'Archivo no existe' });
    if (oldFull === newFull) return res.json({ name: newSafe, ext: path.extname(newSafe).toLowerCase() });
    if (fs.existsSync(newFull)) return res.status(409).json({ error: 'Ya existe un archivo con ese nombre' });
    fs.renameSync(oldFull, newFull);
    res.json({ name: newSafe, ext: path.extname(newSafe).toLowerCase() });
  } catch (err) {
    console.error('[file-api] /files/rename error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/files/move?id=...&name=...   body: { toFolder }
router.post('/files/move', express.json(), async (req, res) => {
  try {
    const id = String(req.query.id || '');
    const name = String(req.query.name || '');
    const toFolder = String((req.body && req.body.toFolder) || '').trim();
    if (!toFolder) return res.status(400).json({ error: 'Carpeta destino faltante' });
    if (toFolder === id) return res.status(400).json({ error: 'Misma carpeta' });
    const [from, to] = await Promise.all([resolveFolder(id), resolveFolder(toFolder)]);
    if (!from) return res.status(404).json({ error: 'Carpeta origen no existe' });
    if (!to) return res.status(404).json({ error: 'Carpeta destino no existe' });
    const decoded = decodeURIComponent(name);
    const fromFull = safeJoin(from.dir, decoded);
    if (!fromFull || !fs.existsSync(fromFull)) return res.status(404).json({ error: 'Archivo no existe' });
    fs.mkdirSync(to.dir, { recursive: true });
    const finalName = uniqueName(to.dir, decoded);
    const toFull = path.join(to.dir, finalName);
    if (!toFull.startsWith(to.dir)) return res.status(400).json({ error: 'Ruta inválida' });
    fs.renameSync(fromFull, toFull);
    res.json({ name: finalName, folder: toFolder });
  } catch (err) {
    console.error('[file-api] /files/move error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
