const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = path.join(dataDir, 'conversations.db');

let db;

// sql.js requiere inicialización async, pero después las queries son sync
async function init() {
  if (db) return;

  const SQL = await initSqlJs();

  // Cargar DB existente si hay, sino crear nueva
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      phone TEXT PRIMARY KEY,
      history TEXT DEFAULT '[]',
      stage TEXT DEFAULT 'greeting',
      context TEXT DEFAULT '{}',
      report TEXT,
      followup_sent INTEGER DEFAULT 0,
      drive_folder_id TEXT,
      demo_status TEXT DEFAULT 'none',
      client_stage TEXT DEFAULT 'lead',
      timeline TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL DEFAULT '',
      client_phone TEXT DEFAULT '',
      client_email TEXT DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      type TEXT DEFAULT '',
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'planning',
      budget TEXT DEFAULT '',
      budget_status TEXT DEFAULT 'not_quoted',
      tasks TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      created_by TEXT DEFAULT 'david',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Migraciones idempotentes: agregar columnas si la DB ya existía sin ellas
  const migrations = [
    'ALTER TABLE conversations ADD COLUMN followup_sent INTEGER DEFAULT 0',
    'ALTER TABLE conversations ADD COLUMN drive_folder_id TEXT',
    "ALTER TABLE conversations ADD COLUMN demo_status TEXT DEFAULT 'none'",
    "ALTER TABLE conversations ADD COLUMN client_stage TEXT DEFAULT 'lead'",
    "ALTER TABLE conversations ADD COLUMN timeline TEXT DEFAULT '[]'",
    "ALTER TABLE conversations ADD COLUMN notes TEXT DEFAULT ''",
  ];
  for (const sql of migrations) {
    try { db.run(sql); } catch (e) { /* columna ya existe */ }
  }

  save();
}

// Persistir a disco después de cada escritura
function save() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function getConversation(phone) {
  const stmt = db.prepare('SELECT * FROM conversations WHERE phone = ?');
  stmt.bind([phone]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject();
  stmt.free();

  return {
    ...row,
    history: JSON.parse(row.history),
    context: JSON.parse(row.context),
    report: row.report ? JSON.parse(row.report) : null,
    timeline: row.timeline ? JSON.parse(row.timeline) : [],
  };
}

function upsertConversation(phone, fields) {
  const current = getConversation(phone);
  const data = {
    $phone: phone,
    $history: JSON.stringify(fields.history ?? current?.history ?? []),
    $stage: fields.stage ?? current?.stage ?? 'greeting',
    $context: JSON.stringify(fields.context ?? current?.context ?? {}),
    $report: fields.report ? JSON.stringify(fields.report) : (current?.report ? JSON.stringify(current.report) : null),
  };

  db.run(`
    INSERT INTO conversations (phone, history, stage, context, report, updated_at)
    VALUES ($phone, $history, $stage, $context, $report, datetime('now'))
    ON CONFLICT(phone) DO UPDATE SET
      history = $history,
      stage = $stage,
      context = $context,
      report = $report,
      updated_at = datetime('now')
  `, data);

  save();
}

function setContext(phone, context) {
  const current = getConversation(phone);
  if (current) {
    db.run('UPDATE conversations SET context = ?, updated_at = datetime(\'now\') WHERE phone = ?',
      [JSON.stringify(context), phone]);
  } else {
    db.run('INSERT INTO conversations (phone, context) VALUES (?, ?)',
      [phone, JSON.stringify(context)]);
  }
  save();
}

// Conversaciones sin respuesta del cliente hace más de X horas
// Solo en fases activas (gathering/confirming) y sin follow-up enviado
function getStaleConversations(hoursAgo) {
  const results = [];
  const stmt = db.prepare(`
    SELECT * FROM conversations
    WHERE stage IN ('gathering', 'confirming')
    AND followup_sent = 0
    AND updated_at <= datetime('now', ?)
  `);
  stmt.bind([`-${hoursAgo} hours`]);

  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      ...row,
      history: JSON.parse(row.history),
      context: JSON.parse(row.context),
      report: row.report ? JSON.parse(row.report) : null,
    });
  }
  stmt.free();
  return results;
}

// Conversaciones con follow-up enviado hace más de X horas (para notificar a David)
function getAbandonedConversations(hoursAfterFollowup) {
  const results = [];
  const stmt = db.prepare(`
    SELECT * FROM conversations
    WHERE stage IN ('gathering', 'confirming')
    AND followup_sent = 1
    AND updated_at <= datetime('now', ?)
  `);
  stmt.bind([`-${hoursAfterFollowup} hours`]);

  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      ...row,
      history: JSON.parse(row.history),
      context: JSON.parse(row.context),
    });
  }
  stmt.free();
  return results;
}

function markFollowupSent(phone) {
  db.run('UPDATE conversations SET followup_sent = ?, updated_at = datetime(\'now\') WHERE phone = ?',
    [1, phone]);
  save();
}

function markAbandoned(phone) {
  db.run('UPDATE conversations SET followup_sent = ?, updated_at = datetime(\'now\') WHERE phone = ?',
    [2, phone]);
  save();
}

// ---------- CRM / Demos ----------

function updateDemoStatus(phone, status) {
  db.run('UPDATE conversations SET demo_status = ?, updated_at = datetime(\'now\') WHERE phone = ?',
    [status, phone]);
  save();
}

function updateClientStage(phone, clientStage) {
  db.run('UPDATE conversations SET client_stage = ?, updated_at = datetime(\'now\') WHERE phone = ?',
    [clientStage, phone]);
  save();
}

function setDriveFolderId(phone, folderId) {
  db.run('UPDATE conversations SET drive_folder_id = ?, updated_at = datetime(\'now\') WHERE phone = ?',
    [folderId, phone]);
  save();
}

function setNotes(phone, notes) {
  db.run('UPDATE conversations SET notes = ?, updated_at = datetime(\'now\') WHERE phone = ?',
    [notes, phone]);
  save();
}

function appendTimelineEvent(phone, event) {
  const current = getConversation(phone);
  const timeline = current?.timeline || [];
  timeline.push({ date: new Date().toISOString(), ...event });
  db.run('UPDATE conversations SET timeline = ?, updated_at = datetime(\'now\') WHERE phone = ?',
    [JSON.stringify(timeline), phone]);
  save();
}

function listAllClients() {
  const results = [];
  const stmt = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC');
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      ...row,
      history: JSON.parse(row.history),
      context: JSON.parse(row.context),
      report: row.report ? JSON.parse(row.report) : null,
      timeline: row.timeline ? JSON.parse(row.timeline) : [],
    });
  }
  stmt.free();
  return results;
}

function getClientsByStage(clientStage) {
  const results = [];
  const stmt = db.prepare('SELECT * FROM conversations WHERE client_stage = ? ORDER BY updated_at DESC');
  stmt.bind([clientStage]);
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      ...row,
      history: JSON.parse(row.history),
      context: JSON.parse(row.context),
      report: row.report ? JSON.parse(row.report) : null,
      timeline: row.timeline ? JSON.parse(row.timeline) : [],
    });
  }
  stmt.free();
  return results;
}

// ─── Projects ───────────────────────────────────────────────────────────────

function parseProject(row) {
  return { ...row, tasks: row.tasks ? JSON.parse(row.tasks) : [] };
}

function listProjects() {
  const results = [];
  const stmt = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC');
  while (stmt.step()) results.push(parseProject(stmt.getAsObject()));
  stmt.free();
  return results;
}

function getProject(id) {
  const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
  stmt.bind([id]);
  if (!stmt.step()) { stmt.free(); return null; }
  const row = stmt.getAsObject();
  stmt.free();
  return parseProject(row);
}

function createProject(data) {
  const id = `proj_${Date.now()}`;
  db.run(
    `INSERT INTO projects (id, client_name, client_phone, client_email, title, type, description, status, budget, budget_status, tasks, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.client_name || '', data.client_phone || '', data.client_email || '',
     data.title || '', data.type || '', data.description || '',
     data.status || 'planning', data.budget || '', data.budget_status || 'not_quoted',
     JSON.stringify(data.tasks || []), data.notes || '', data.created_by || 'david']
  );
  save();
  return id;
}

function updateProject(id, data) {
  db.run(
    `UPDATE projects SET client_name=?, client_phone=?, client_email=?, title=?, type=?, description=?,
     status=?, budget=?, budget_status=?, tasks=?, notes=?, updated_at=datetime('now') WHERE id=?`,
    [data.client_name || '', data.client_phone || '', data.client_email || '',
     data.title || '', data.type || '', data.description || '',
     data.status || 'planning', data.budget || '', data.budget_status || 'not_quoted',
     JSON.stringify(data.tasks || []), data.notes || '', id]
  );
  save();
}

function deleteProject(id) {
  db.run('DELETE FROM projects WHERE id = ?', [id]);
  save();
}

module.exports = {
  init, getConversation, upsertConversation, setContext,
  getStaleConversations, getAbandonedConversations, markFollowupSent, markAbandoned,
  updateDemoStatus, updateClientStage, setDriveFolderId, setNotes,
  appendTimelineEvent, listAllClients, getClientsByStage,
  listProjects, getProject, createProject, updateProject, deleteProject,
};
