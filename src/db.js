const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

// Si TURSO_DATABASE_URL está seteado → usa Turso cloud (recomendado para producción)
// Si no → usa SQLite local en el Volume de Railway (fallback)
let client;

function getDb() {
  if (!client) {
    const dataDir = path.join(__dirname, '..', 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    const url = process.env.TURSO_DATABASE_URL
      || `file:${path.join(dataDir, 'conversations.db')}`;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    client = createClient({ url, authToken });
    console.log(`[db] Usando: ${url.startsWith('libsql') || url.startsWith('https') ? 'Turso cloud' : 'SQLite local'}`);
  }
  return client;
}

async function init() {
  const db = getDb();

  await db.execute(`
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
      demo_notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
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
      updates_log TEXT DEFAULT '[]',
      is_personal INTEGER DEFAULT 0,
      category TEXT DEFAULT 'cliente',
      deadline TEXT,
      client_id TEXT DEFAULT '',
      created_by TEXT DEFAULT 'david',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS client_records (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      company TEXT DEFAULT '',
      category TEXT DEFAULT 'cliente',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS document_folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      color TEXT DEFAULT '#3b82f6',
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Migraciones idempotentes
  const migrations = [
    `ALTER TABLE conversations ADD COLUMN followup_sent INTEGER DEFAULT 0`,
    `ALTER TABLE conversations ADD COLUMN drive_folder_id TEXT`,
    `ALTER TABLE conversations ADD COLUMN demo_status TEXT DEFAULT 'none'`,
    `ALTER TABLE conversations ADD COLUMN client_stage TEXT DEFAULT 'lead'`,
    `ALTER TABLE conversations ADD COLUMN timeline TEXT DEFAULT '[]'`,
    `ALTER TABLE conversations ADD COLUMN notes TEXT DEFAULT ''`,
    `ALTER TABLE conversations ADD COLUMN demo_notes TEXT DEFAULT ''`,
  ];
  for (const sql of migrations) {
    try { await db.execute(sql); } catch (e) { /* columna ya existe */ }
  }

  // Projects migrations
  const projectMigrations = [
    `ALTER TABLE projects ADD COLUMN updates_log TEXT DEFAULT '[]'`,
    `ALTER TABLE projects ADD COLUMN is_personal INTEGER DEFAULT 0`,
    `ALTER TABLE projects ADD COLUMN deadline TEXT`,
    `ALTER TABLE projects ADD COLUMN category TEXT DEFAULT 'cliente'`,
    `ALTER TABLE projects ADD COLUMN client_id TEXT DEFAULT ''`,
  ];
  for (const sql of projectMigrations) {
    try { await db.execute(sql); } catch (e) { /* already exists */ }
  }
}

// ─── Helpers de parsing ───────────────────────────────────────────────────────

function parseConv(row) {
  if (!row) return null;
  return {
    phone: row.phone,
    history: JSON.parse(String(row.history || '[]')),
    stage: String(row.stage || 'greeting'),
    context: JSON.parse(String(row.context || '{}')),
    report: row.report ? JSON.parse(String(row.report)) : null,
    followup_sent: Number(row.followup_sent || 0),
    drive_folder_id: row.drive_folder_id || null,
    demo_status: String(row.demo_status || 'none'),
    client_stage: String(row.client_stage || 'lead'),
    timeline: row.timeline ? JSON.parse(String(row.timeline)) : [],
    notes: String(row.notes || ''),
    demo_notes: String(row.demo_notes || ''),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Parsea JSON con tolerancia a double-stringify y datos corruptos
function safeParseArray(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    // Double-stringify: si parseó como string, intentar un segundo parse
    if (typeof parsed === 'string') {
      try { const p2 = JSON.parse(parsed); return Array.isArray(p2) ? p2 : []; } catch { return []; }
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function parseProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    client_name: String(row.client_name || ''),
    client_phone: String(row.client_phone || ''),
    client_email: String(row.client_email || ''),
    title: String(row.title || ''),
    type: String(row.type || ''),
    description: String(row.description || ''),
    status: String(row.status || 'planning'),
    budget: String(row.budget || ''),
    budget_status: String(row.budget_status || 'not_quoted'),
    tasks: safeParseArray(row.tasks),
    notes: String(row.notes || ''),
    updates_log: safeParseArray(row.updates_log),
    is_personal: Number(row.is_personal || 0) === 1,
    category: String(row.category || 'cliente'),
    deadline: row.deadline || null,
    client_id: String(row.client_id || ''),
    created_by: String(row.created_by || 'david'),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─── Conversations ────────────────────────────────────────────────────────────

async function getConversation(phone) {
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT * FROM conversations WHERE phone = ?', args: [phone] });
  return result.rows.length ? parseConv(result.rows[0]) : null;
}

async function upsertConversation(phone, fields) {
  const current = await getConversation(phone);
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO conversations (phone, history, stage, context, report, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(phone) DO UPDATE SET
            history = excluded.history,
            stage = excluded.stage,
            context = excluded.context,
            report = excluded.report,
            updated_at = datetime('now')`,
    args: [
      phone,
      JSON.stringify(fields.history ?? current?.history ?? []),
      fields.stage ?? current?.stage ?? 'greeting',
      JSON.stringify(fields.context ?? current?.context ?? {}),
      fields.report ? JSON.stringify(fields.report) : (current?.report ? JSON.stringify(current.report) : null),
    ],
  });
}

async function setContext(phone, context) {
  const current = await getConversation(phone);
  const db = getDb();
  if (current) {
    await db.execute({
      sql: `UPDATE conversations SET context = ?, updated_at = datetime('now') WHERE phone = ?`,
      args: [JSON.stringify(context), phone],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO conversations (phone, context) VALUES (?, ?)`,
      args: [phone, JSON.stringify(context)],
    });
  }
}

async function getStaleConversations(hoursAgo) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM conversations WHERE stage IN ('gathering','confirming') AND followup_sent = 0 AND updated_at <= datetime('now', ?)`,
    args: [`-${hoursAgo} hours`],
  });
  return result.rows.map(parseConv);
}

async function getAbandonedConversations(hoursAfterFollowup) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM conversations WHERE stage IN ('gathering','confirming') AND followup_sent = 1 AND updated_at <= datetime('now', ?)`,
    args: [`-${hoursAfterFollowup} hours`],
  });
  return result.rows.map(parseConv);
}

async function markFollowupSent(phone) {
  const db = getDb();
  await db.execute({ sql: `UPDATE conversations SET followup_sent = 1, updated_at = datetime('now') WHERE phone = ?`, args: [phone] });
}

async function markAbandoned(phone) {
  const db = getDb();
  await db.execute({ sql: `UPDATE conversations SET followup_sent = 2, updated_at = datetime('now') WHERE phone = ?`, args: [phone] });
}

// ─── CRM / Demos ──────────────────────────────────────────────────────────────

async function updateDemoStatus(phone, status) {
  const db = getDb();
  await db.execute({ sql: `UPDATE conversations SET demo_status = ?, updated_at = datetime('now') WHERE phone = ?`, args: [status, phone] });
}

async function updateClientStage(phone, clientStage) {
  const db = getDb();
  await db.execute({ sql: `UPDATE conversations SET client_stage = ?, updated_at = datetime('now') WHERE phone = ?`, args: [clientStage, phone] });
}

async function setDriveFolderId(phone, folderId) {
  const db = getDb();
  await db.execute({ sql: `UPDATE conversations SET drive_folder_id = ?, updated_at = datetime('now') WHERE phone = ?`, args: [folderId, phone] });
}

async function setNotes(phone, notes) {
  const db = getDb();
  await db.execute({ sql: `UPDATE conversations SET notes = ?, updated_at = datetime('now') WHERE phone = ?`, args: [notes, phone] });
}

async function setDemoNotes(phone, notes) {
  const db = getDb();
  await db.execute({ sql: `UPDATE conversations SET demo_notes = ?, updated_at = datetime('now') WHERE phone = ?`, args: [notes, phone] });
}

async function appendTimelineEvent(phone, event) {
  const current = await getConversation(phone);
  const db = getDb();
  const timeline = current?.timeline || [];
  timeline.push({ date: new Date().toISOString(), ...event });
  await db.execute({
    sql: `UPDATE conversations SET timeline = ?, updated_at = datetime('now') WHERE phone = ?`,
    args: [JSON.stringify(timeline), phone],
  });
}

async function listAllClients() {
  const db = getDb();
  const result = await db.execute('SELECT * FROM conversations ORDER BY updated_at DESC');
  return result.rows.map(parseConv);
}

async function getClientsByStage(clientStage) {
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT * FROM conversations WHERE client_stage = ? ORDER BY updated_at DESC', args: [clientStage] });
  return result.rows.map(parseConv);
}

// ─── Projects ─────────────────────────────────────────────────────────────────

async function listProjects() {
  const db = getDb();
  const result = await db.execute('SELECT * FROM projects ORDER BY updated_at DESC');
  return result.rows.map(parseProject);
}

async function getProject(id) {
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [id] });
  return result.rows.length ? parseProject(result.rows[0]) : null;
}

async function createProject(data) {
  const id = `proj_${Date.now()}`;
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO projects (id, client_name, client_phone, client_email, title, type, description, status, budget, budget_status, tasks, notes, is_personal, deadline, category, client_id, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, data.client_name || '', data.client_phone || '', data.client_email || '',
           data.title || '', data.type || '', data.description || '',
           data.status || 'planning', data.budget || '', data.budget_status || 'not_quoted',
           JSON.stringify(data.tasks || []), data.notes || '', data.is_personal ? 1 : 0,
           data.deadline || null, data.category || 'cliente', data.client_id || '', data.created_by || 'david'],
  });
  return id;
}

async function updateProject(id, data) {
  const db = getDb();
  await db.execute({
    sql: `UPDATE projects SET client_name=?, client_phone=?, client_email=?, title=?, type=?, description=?,
          status=?, budget=?, budget_status=?, tasks=?, notes=?, is_personal=?, category=?, deadline=?, client_id=?, updated_at=datetime('now') WHERE id=?`,
    args: [data.client_name || '', data.client_phone || '', data.client_email || '',
           data.title || '', data.type || '', data.description || '',
           data.status || 'planning', data.budget || '', data.budget_status || 'not_quoted',
           JSON.stringify(data.tasks || []), data.notes || '', data.is_personal ? 1 : 0,
           data.category || 'cliente', data.deadline || null, data.client_id || '', id],
  });
}

async function deleteProject(id) {
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [id] });
}

async function addProjectUpdate(id, text) {
  const project = await getProject(id);
  if (!project) return;
  const db = getDb();
  const log = project.updates_log || [];
  log.unshift({ date: new Date().toISOString(), text: String(text).trim() });
  await db.execute({
    sql: `UPDATE projects SET updates_log = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [JSON.stringify(log), id],
  });
}

// ─── Client Records ───────────────────────────────────────────────────────────

function parseClientRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: String(row.name || ''),
    phone: String(row.phone || ''),
    email: String(row.email || ''),
    company: String(row.company || ''),
    category: String(row.category || 'cliente'),
    notes: String(row.notes || ''),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listClientRecords() {
  const db = getDb();
  const result = await db.execute('SELECT * FROM client_records ORDER BY updated_at DESC');
  return result.rows.map(parseClientRecord);
}

async function getClientRecord(id) {
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT * FROM client_records WHERE id = ?', args: [id] });
  return result.rows.length ? parseClientRecord(result.rows[0]) : null;
}

async function createClientRecord(data) {
  const id = `cl_${Date.now()}`;
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO client_records (id, name, phone, email, company, category, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, data.name || '', data.phone || '', data.email || '',
           data.company || '', data.category || 'cliente', data.notes || ''],
  });
  return id;
}

async function updateClientRecord(id, data) {
  const db = getDb();
  await db.execute({
    sql: `UPDATE client_records SET name=?, phone=?, email=?, company=?, category=?, notes=?, updated_at=datetime('now') WHERE id=?`,
    args: [data.name || '', data.phone || '', data.email || '',
           data.company || '', data.category || 'cliente', data.notes || '', id],
  });
}

async function deleteClientRecord(id) {
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM client_records WHERE id = ?', args: [id] });
}

async function getProjectsByClientId(clientId) {
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT * FROM projects WHERE client_id = ? ORDER BY updated_at DESC', args: [clientId] });
  return result.rows.map(parseProject);
}

// ─── Document Folders ─────────────────────────────────────────────────────────
async function listDocumentFolders() {
  const db = getDb();
  const result = await db.execute('SELECT * FROM document_folders ORDER BY name ASC');
  return result.rows.map(r => ({ id: r.id, name: String(r.name||''), color: String(r.color||'#3b82f6'), description: String(r.description||''), created_at: r.created_at }));
}
async function createDocumentFolder(data) {
  const id = `df_${Date.now()}`;
  const db = getDb();
  await db.execute({ sql: `INSERT INTO document_folders (id, name, color, description) VALUES (?,?,?,?)`, args: [id, data.name||'', data.color||'#3b82f6', data.description||''] });
  return id;
}
async function deleteDocumentFolder(id) {
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM document_folders WHERE id = ?', args: [id] });
}

module.exports = {
  init, getConversation, upsertConversation, setContext,
  getStaleConversations, getAbandonedConversations, markFollowupSent, markAbandoned,
  updateDemoStatus, updateClientStage, setDriveFolderId, setNotes, setDemoNotes,
  appendTimelineEvent, listAllClients, getClientsByStage,
  listProjects, getProject, createProject, updateProject, deleteProject, addProjectUpdate,
  listClientRecords, getClientRecord, createClientRecord, updateClientRecord, deleteClientRecord, getProjectsByClientId,
  listDocumentFolders, createDocumentFolder, deleteDocumentFolder,
};
