import { createClient, type Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    // El admin nuevo (web/) y el legacy (src/) comparten data dir en la raíz del repo
    const dataDir = path.resolve(process.cwd(), '..', 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    const url = process.env.TURSO_DATABASE_URL
      || `file:${path.join(dataDir, 'conversations.db')}`;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    client = createClient({ url, authToken });
    console.log(`[db] Usando: ${url.startsWith('libsql') || url.startsWith('https') ? 'Turso cloud' : 'SQLite local'}`);
  }
  return client;
}

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface Conversation {
  phone: string;
  history: Array<{ role: string; content: string; ts?: string }>;
  stage: string;
  context: Record<string, unknown>;
  report: ConversationReport | null;
  followup_sent: number;
  drive_folder_id: string | null;
  demo_status: string;
  client_stage: string;
  timeline: Array<{ date: string; event: string; note?: string }>;
  notes: string;
  demo_notes: string;
  archived: number;
  demo_started_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface ConversationReport {
  cliente?: { nombre?: string; rubro?: string; nivel_tecnico?: string; email?: string };
  proyecto?: {
    tipo?: string;
    descripcion?: string;
    plataforma?: string;
    funcionalidades?: string[];
    audiencia_objetivo?: string;
    modelo_negocio?: string;
    integraciones_necesarias?: string[];
    estado_actual?: string;
  };
  requisitos?: { plazo?: string; presupuesto?: string; urgencia?: string; stack_sugerido?: string };
  resumen_ejecutivo?: string;
  analisis?: {
    complejidad_estimada?: string;
    horas_estimadas?: number;
    recomendaciones_tecnicas?: string[];
    recomendaciones?: string[];
    mvp_sugerido?: string;
  };
}

export interface Project {
  id: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  title: string;
  type: string;
  description: string;
  status: string;
  budget: string;
  budget_status: string;
  tasks: Array<Record<string, unknown>>;
  notes: string;
  updates_log: Array<{ date: string; text: string }>;
  is_personal: boolean;
  category: string;
  deadline: string | null;
  client_id: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  category: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  phone: string;
  is_read: number;
  created_at?: string;
}

// ─── Init ─────────────────────────────────────────────────────────────────

export async function init() {
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
      archived INTEGER DEFAULT 0,
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT DEFAULT 'info',
      title TEXT NOT NULL DEFAULT '',
      body TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Migraciones idempotentes
  for (const sql of [
    `ALTER TABLE conversations ADD COLUMN followup_sent INTEGER DEFAULT 0`,
    `ALTER TABLE conversations ADD COLUMN drive_folder_id TEXT`,
    `ALTER TABLE conversations ADD COLUMN demo_status TEXT DEFAULT 'none'`,
    `ALTER TABLE conversations ADD COLUMN client_stage TEXT DEFAULT 'lead'`,
    `ALTER TABLE conversations ADD COLUMN timeline TEXT DEFAULT '[]'`,
    `ALTER TABLE conversations ADD COLUMN notes TEXT DEFAULT ''`,
    `ALTER TABLE conversations ADD COLUMN demo_notes TEXT DEFAULT ''`,
    `ALTER TABLE conversations ADD COLUMN archived INTEGER DEFAULT 0`,
    `ALTER TABLE conversations ADD COLUMN demo_started_at TEXT DEFAULT ''`,
    `ALTER TABLE projects ADD COLUMN updates_log TEXT DEFAULT '[]'`,
    `ALTER TABLE projects ADD COLUMN is_personal INTEGER DEFAULT 0`,
    `ALTER TABLE projects ADD COLUMN deadline TEXT`,
    `ALTER TABLE projects ADD COLUMN category TEXT DEFAULT 'cliente'`,
    `ALTER TABLE projects ADD COLUMN client_id TEXT DEFAULT ''`,
  ]) {
    try { await db.execute(sql); } catch { /* columna ya existe */ }
  }

  for (const sql of [
    `CREATE INDEX IF NOT EXISTS idx_conv_client_stage ON conversations(client_stage)`,
    `CREATE INDEX IF NOT EXISTS idx_conv_archived ON conversations(archived)`,
    `CREATE INDEX IF NOT EXISTS idx_conv_updated_at ON conversations(updated_at)`,
    `CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at)`,
    `CREATE INDEX IF NOT EXISTS idx_notif_is_read ON notifications(is_read)`,
    `CREATE INDEX IF NOT EXISTS idx_notif_created_at ON notifications(created_at)`,
  ]) {
    try { await db.execute(sql); } catch { /* index already exists */ }
  }
}

// Init eager para que el primer request no pague el costo
let initPromise: Promise<void> | null = null;
export function ensureInit(): Promise<void> {
  if (!initPromise) initPromise = init().catch(err => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

// ─── Parsers ──────────────────────────────────────────────────────────────

function safeParseJSON<T>(str: unknown, fallback: T): T {
  try { return JSON.parse(String(str)) as T; } catch { return fallback; }
}

function safeParseArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    if (typeof parsed === 'string') {
      try { const p2 = JSON.parse(parsed); return Array.isArray(p2) ? p2 : []; } catch { return []; }
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function parseConv(row: Record<string, unknown>): Conversation {
  return {
    phone: String(row.phone),
    history: row.history != null ? safeParseJSON(row.history, []) : [],
    stage: String(row.stage || 'greeting'),
    context: row.context != null ? safeParseJSON(row.context, {}) : {},
    report: row.report ? safeParseJSON<ConversationReport | null>(row.report, null) : null,
    followup_sent: Number(row.followup_sent || 0),
    drive_folder_id: (row.drive_folder_id as string) || null,
    demo_status: String(row.demo_status || 'none'),
    client_stage: String(row.client_stage || 'lead'),
    timeline: row.timeline ? safeParseJSON(row.timeline, []) : [],
    notes: String(row.notes || ''),
    demo_notes: String(row.demo_notes || ''),
    archived: Number(row.archived || 0),
    demo_started_at: String(row.demo_started_at || ''),
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

function parseProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
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
    deadline: (row.deadline as string) || null,
    client_id: String(row.client_id || ''),
    created_by: String(row.created_by || 'david'),
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

function parseClientRecord(row: Record<string, unknown>): ClientRecord {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    phone: String(row.phone || ''),
    email: String(row.email || ''),
    company: String(row.company || ''),
    category: String(row.category || 'cliente'),
    notes: String(row.notes || ''),
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

// ─── Conversations ────────────────────────────────────────────────────────

export async function getConversation(phone: string): Promise<Conversation | null> {
  await ensureInit();
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT * FROM conversations WHERE phone = ?', args: [phone] });
  return result.rows.length ? parseConv(result.rows[0] as unknown as Record<string, unknown>) : null;
}

export async function upsertConversation(phone: string, fields: Partial<Conversation>): Promise<void> {
  await ensureInit();
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

export async function setContext(phone: string, context: Record<string, unknown>): Promise<void> {
  await ensureInit();
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

export async function getStaleConversations(hoursAgo: number): Promise<Conversation[]> {
  await ensureInit();
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM conversations WHERE stage IN ('gathering','confirming') AND followup_sent = 0 AND updated_at <= datetime('now', ?)`,
    args: [`-${hoursAgo} hours`],
  });
  return result.rows.map(r => parseConv(r as unknown as Record<string, unknown>));
}

export async function getAbandonedConversations(hoursAfterFollowup: number): Promise<Conversation[]> {
  await ensureInit();
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM conversations WHERE stage IN ('gathering','confirming') AND followup_sent = 1 AND updated_at <= datetime('now', ?)`,
    args: [`-${hoursAfterFollowup} hours`],
  });
  return result.rows.map(r => parseConv(r as unknown as Record<string, unknown>));
}

export async function markFollowupSent(phone: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: `UPDATE conversations SET followup_sent = 1, updated_at = datetime('now') WHERE phone = ?`, args: [phone] });
}

export async function markAbandoned(phone: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: `UPDATE conversations SET followup_sent = 2, updated_at = datetime('now') WHERE phone = ?`, args: [phone] });
}

export async function updateDemoStatus(phone: string, status: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: `UPDATE conversations SET demo_status = ?, updated_at = datetime('now') WHERE phone = ?`, args: [status, phone] });
}

export async function updateClientStage(phone: string, clientStage: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: `UPDATE conversations SET client_stage = ?, updated_at = datetime('now') WHERE phone = ?`, args: [clientStage, phone] });
}

export async function setDriveFolderId(phone: string, folderId: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: `UPDATE conversations SET drive_folder_id = ?, updated_at = datetime('now') WHERE phone = ?`, args: [folderId, phone] });
}

export async function setNotes(phone: string, notes: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: `UPDATE conversations SET notes = ?, updated_at = datetime('now') WHERE phone = ?`, args: [notes, phone] });
}

export async function setDemoNotes(phone: string, notes: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: `UPDATE conversations SET demo_notes = ?, updated_at = datetime('now') WHERE phone = ?`, args: [notes, phone] });
}

export async function setDemoStartedAt(phone: string, isoDate: string | null): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: `UPDATE conversations SET demo_started_at = ?, updated_at = datetime('now') WHERE phone = ?`, args: [isoDate || '', phone] });
}

export async function appendTimelineEvent(phone: string, event: { event: string; note?: string }): Promise<void> {
  await ensureInit();
  const current = await getConversation(phone);
  const timeline = current?.timeline || [];
  timeline.push({ date: new Date().toISOString(), ...event });
  await getDb().execute({
    sql: `UPDATE conversations SET timeline = ?, updated_at = datetime('now') WHERE phone = ?`,
    args: [JSON.stringify(timeline), phone],
  });
}

export async function listAllClients(includeArchived = false): Promise<Conversation[]> {
  await ensureInit();
  const cols = 'phone, stage, client_stage, demo_status, report, timeline, updated_at, created_at, followup_sent, archived, notes, demo_notes, drive_folder_id';
  const sql = includeArchived
    ? `SELECT ${cols} FROM conversations ORDER BY updated_at DESC`
    : `SELECT ${cols} FROM conversations WHERE archived = 0 OR archived IS NULL ORDER BY updated_at DESC`;
  const result = await getDb().execute(sql);
  return result.rows.map(r => parseConv(r as unknown as Record<string, unknown>));
}

export async function getClientsByStage(clientStage: string): Promise<Conversation[]> {
  await ensureInit();
  const result = await getDb().execute({ sql: 'SELECT * FROM conversations WHERE client_stage = ? ORDER BY updated_at DESC', args: [clientStage] });
  return result.rows.map(r => parseConv(r as unknown as Record<string, unknown>));
}

export async function archiveConversation(phone: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: `UPDATE conversations SET archived = 1, updated_at = datetime('now') WHERE phone = ?`, args: [phone] });
}

export async function unarchiveConversation(phone: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: `UPDATE conversations SET archived = 0, updated_at = datetime('now') WHERE phone = ?`, args: [phone] });
}

export async function deleteConversation(phone: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: 'DELETE FROM conversations WHERE phone = ?', args: [phone] });
}

export async function resetConversation(phone: string): Promise<void> {
  await ensureInit();
  await getDb().execute({
    sql: `UPDATE conversations SET history = '[]', stage = 'greeting', context = '{}',
          report = NULL, demo_status = 'none', client_stage = 'lead', timeline = '[]',
          notes = '', demo_notes = '', followup_sent = 0, archived = 0,
          updated_at = datetime('now') WHERE phone = ?`,
    args: [phone],
  });
}

// ─── Projects ─────────────────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  await ensureInit();
  const result = await getDb().execute('SELECT * FROM projects ORDER BY updated_at DESC');
  return result.rows.map(r => parseProject(r as unknown as Record<string, unknown>));
}

export async function getProject(id: string): Promise<Project | null> {
  await ensureInit();
  const result = await getDb().execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [id] });
  return result.rows.length ? parseProject(result.rows[0] as unknown as Record<string, unknown>) : null;
}

export async function createProject(data: Partial<Project>): Promise<string> {
  await ensureInit();
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await getDb().execute({
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

export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
  await ensureInit();
  await getDb().execute({
    sql: `UPDATE projects SET client_name=?, client_phone=?, client_email=?, title=?, type=?, description=?,
          status=?, budget=?, budget_status=?, tasks=?, notes=?, is_personal=?, category=?, deadline=?, client_id=?, updated_at=datetime('now') WHERE id=?`,
    args: [data.client_name || '', data.client_phone || '', data.client_email || '',
           data.title || '', data.type || '', data.description || '',
           data.status || 'planning', data.budget || '', data.budget_status || 'not_quoted',
           JSON.stringify(data.tasks || []), data.notes || '', data.is_personal ? 1 : 0,
           data.category || 'cliente', data.deadline || null, data.client_id || '', id],
  });
}

export async function updateProjectStatus(id: string, status: string): Promise<void> {
  await ensureInit();
  await getDb().execute({
    sql: `UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [status, id],
  });
}

export async function deleteProject(id: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [id] });
}

export async function addProjectUpdate(id: string, text: string): Promise<void> {
  await ensureInit();
  const project = await getProject(id);
  if (!project) return;
  const log = project.updates_log || [];
  log.unshift({ date: new Date().toISOString(), text: String(text).trim() });
  await getDb().execute({
    sql: `UPDATE projects SET updates_log = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [JSON.stringify(log), id],
  });
}

// ─── Client Records ───────────────────────────────────────────────────────

export async function listClientRecords(): Promise<ClientRecord[]> {
  await ensureInit();
  const result = await getDb().execute('SELECT * FROM client_records ORDER BY updated_at DESC');
  return result.rows.map(r => parseClientRecord(r as unknown as Record<string, unknown>));
}

export async function getClientRecord(id: string): Promise<ClientRecord | null> {
  await ensureInit();
  const result = await getDb().execute({ sql: 'SELECT * FROM client_records WHERE id = ?', args: [id] });
  return result.rows.length ? parseClientRecord(result.rows[0] as unknown as Record<string, unknown>) : null;
}

export async function createClientRecord(data: Partial<ClientRecord>): Promise<string> {
  await ensureInit();
  const id = `cl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await getDb().execute({
    sql: `INSERT INTO client_records (id, name, phone, email, company, category, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, data.name || '', data.phone || '', data.email || '',
           data.company || '', data.category || 'cliente', data.notes || ''],
  });
  return id;
}

export async function updateClientRecord(id: string, data: Partial<ClientRecord>): Promise<void> {
  await ensureInit();
  await getDb().execute({
    sql: `UPDATE client_records SET name=?, phone=?, email=?, company=?, category=?, notes=?, updated_at=datetime('now') WHERE id=?`,
    args: [data.name || '', data.phone || '', data.email || '',
           data.company || '', data.category || 'cliente', data.notes || '', id],
  });
}

export async function deleteClientRecord(id: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: 'DELETE FROM client_records WHERE id = ?', args: [id] });
}

export async function getProjectsByClientId(clientId: string): Promise<Project[]> {
  await ensureInit();
  const result = await getDb().execute({ sql: 'SELECT * FROM projects WHERE client_id = ? ORDER BY updated_at DESC', args: [clientId] });
  return result.rows.map(r => parseProject(r as unknown as Record<string, unknown>));
}

// ─── Document Folders ─────────────────────────────────────────────────────

export interface DocumentFolder { id: string; name: string; color: string; description: string; created_at?: string }

export async function listDocumentFolders(): Promise<DocumentFolder[]> {
  await ensureInit();
  const result = await getDb().execute('SELECT * FROM document_folders ORDER BY name ASC');
  return result.rows.map(r => ({
    id: String(r.id), name: String(r.name || ''), color: String(r.color || '#3b82f6'),
    description: String(r.description || ''), created_at: r.created_at as string | undefined,
  }));
}

export async function createDocumentFolder(data: Partial<DocumentFolder>): Promise<string> {
  await ensureInit();
  const id = `df_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await getDb().execute({
    sql: `INSERT INTO document_folders (id, name, color, description) VALUES (?,?,?,?)`,
    args: [id, data.name || '', data.color || '#3b82f6', data.description || ''],
  });
  return id;
}

export async function deleteDocumentFolder(id: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: 'DELETE FROM document_folders WHERE id = ?', args: [id] });
}

// ─── Notifications ────────────────────────────────────────────────────────

export async function addNotification(n: { type?: string; title?: string; body?: string; phone?: string }): Promise<string> {
  await ensureInit();
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await getDb().execute({
    sql: `INSERT INTO notifications (id, type, title, body, phone) VALUES (?,?,?,?,?)`,
    args: [id, n.type || 'info', n.title || '', n.body || '', n.phone || ''],
  });
  return id;
}

export async function getNotifications(limit = 50, offset = 0): Promise<Notification[]> {
  await ensureInit();
  const result = await getDb().execute({
    sql: 'SELECT * FROM notifications ORDER BY created_at DESC LIMIT ? OFFSET ?',
    args: [limit, offset],
  });
  return result.rows.map(r => ({
    id: String(r.id), type: String(r.type || 'info'), title: String(r.title || ''),
    body: String(r.body || ''), phone: String(r.phone || ''),
    is_read: Number(r.is_read || 0), created_at: r.created_at as string | undefined,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  await ensureInit();
  const result = await getDb().execute('SELECT COUNT(*) as cnt FROM notifications WHERE is_read = 0');
  return Number((result.rows[0] as Record<string, unknown> | undefined)?.cnt || 0);
}

export async function markNotificationRead(id: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: 'UPDATE notifications SET is_read = 1 WHERE id = ?', args: [id] });
}

export async function markAllNotificationsRead(): Promise<void> {
  await ensureInit();
  await getDb().execute('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
}

export async function deleteNotification(id: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: 'DELETE FROM notifications WHERE id = ?', args: [id] });
}

export async function deleteReadNotifications(): Promise<void> {
  await ensureInit();
  await getDb().execute('DELETE FROM notifications WHERE is_read = 1');
}

export async function deleteAllNotifications(): Promise<void> {
  await ensureInit();
  await getDb().execute('DELETE FROM notifications');
}
