import { createClient, type Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import type { Task } from './constants';

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
  bot_paused: number;
  demo_started_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface ConversationReport {
  cliente?: {
    nombre?: string;
    telefono?: string;
    email?: string;
    contacto_extra?: string;
    rubro?: string;
    ubicacion?: string;
    tiene_negocio_existente?: boolean;
    nivel_tecnico?: string;
  };
  proyecto?: {
    tipo?: string;
    descripcion?: string;
    plataforma?: string;
    funcionalidades?: string[];
    audiencia_objetivo?: string;
    modelo_negocio?: string;
    integraciones_necesarias?: string[];
    estado_actual?: string;
    competencia_mencionada?: string;
    requisitos_seguridad?: string;
    volumen_esperado?: string;
  };
  requisitos?: {
    plazo?: string;
    presupuesto?: string;
    urgencia?: string;
    stack_sugerido?: string;
    notas_adicionales?: string;
  };
  resumen_ejecutivo?: string;
  analisis?: {
    complejidad_estimada?: string;
    horas_estimadas?: string;
    riesgos?: string[];
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
  tasks: Task[];
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL DEFAULT '',
      client_id TEXT DEFAULT '',
      client_name TEXT DEFAULT '',
      project_id TEXT DEFAULT '',
      issue_date TEXT DEFAULT (date('now')),
      due_date TEXT DEFAULT '',
      amount REAL DEFAULT 0,
      currency TEXT DEFAULT 'ARS',
      status TEXT DEFAULT 'draft',
      paid_at TEXT DEFAULT '',
      payment_method TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      items TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
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
    `ALTER TABLE conversations ADD COLUMN bot_paused INTEGER DEFAULT 0`,
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
    `CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date)`,
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
    bot_paused: Number(row.bot_paused || 0),
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

// ─── Lite: lista de conversaciones SIN parsear JSON completo. ─────────────
// Usa json_extract de SQLite para sacar solo los campos que casi todas las
// vistas necesitan (nombre cliente, tipo proyecto). Mucho mas rapido cuando
// hay >50 conversaciones porque evita parsear history/timeline/context/report
// enteros por fila. Usar este cuando la pagina solo necesita listado/conteos
// (dashboard, document-folders targets, etc).
export interface ConversationLite {
  phone: string;
  stage: string;
  client_stage: string;
  demo_status: string;
  followup_sent: number;
  archived: number;
  updated_at: string;
  created_at: string;
  clientName: string | null;
  projectType: string | null;
}

export async function listAllClientsLite(includeArchived = false): Promise<ConversationLite[]> {
  await ensureInit();
  const cols = `
    phone, stage, client_stage, demo_status, followup_sent, archived, updated_at, created_at,
    json_extract(report, '$.cliente.nombre') as clientName,
    json_extract(report, '$.proyecto.tipo') as projectType
  `;
  const sql = includeArchived
    ? `SELECT ${cols} FROM conversations ORDER BY updated_at DESC`
    : `SELECT ${cols} FROM conversations WHERE archived = 0 OR archived IS NULL ORDER BY updated_at DESC`;
  const result = await getDb().execute(sql);
  return result.rows.map(r => {
    const row = r as unknown as Record<string, unknown>;
    return {
      phone: String(row.phone || ''),
      stage: String(row.stage || 'greeting'),
      client_stage: String(row.client_stage || 'lead'),
      demo_status: String(row.demo_status || 'none'),
      followup_sent: Number(row.followup_sent || 0),
      archived: Number(row.archived || 0),
      updated_at: String(row.updated_at || ''),
      created_at: String(row.created_at || ''),
      clientName: row.clientName ? String(row.clientName) : null,
      projectType: row.projectType ? String(row.projectType) : null,
    };
  });
}

// Para el Kanban /admin/clients: trae el report parseado completo pero deja
// history/timeline/context vacios. El report es relativamente chico (~5KB),
// pero history/timeline/context pueden ser cientos de KB por fila. Parsear
// los 3 ultimos era el cuello.
export async function listAllClientsForKanban(includeArchived = false): Promise<Conversation[]> {
  await ensureInit();
  const cols = 'phone, stage, client_stage, demo_status, report, updated_at, created_at, followup_sent, archived, drive_folder_id, demo_started_at, bot_paused';
  const sql = includeArchived
    ? `SELECT ${cols} FROM conversations ORDER BY updated_at DESC`
    : `SELECT ${cols} FROM conversations WHERE archived = 0 OR archived IS NULL ORDER BY updated_at DESC`;
  const result = await getDb().execute(sql);
  return result.rows.map(r => {
    const row = r as unknown as Record<string, unknown>;
    let report: ConversationReport | null = null;
    if (row.report && typeof row.report === 'string') {
      try { report = JSON.parse(row.report) as ConversationReport; }
      catch { /* report invalido, se trata como null */ }
    }
    return {
      phone: String(row.phone || ''),
      history: [],
      stage: String(row.stage || 'greeting'),
      context: {},
      report,
      followup_sent: Number(row.followup_sent || 0),
      drive_folder_id: row.drive_folder_id ? String(row.drive_folder_id) : null,
      demo_status: String(row.demo_status || 'none'),
      client_stage: String(row.client_stage || 'lead'),
      timeline: [],
      notes: '',
      demo_notes: '',
      archived: Number(row.archived || 0),
      bot_paused: Number(row.bot_paused || 0),
      demo_started_at: row.demo_started_at ? String(row.demo_started_at) : '',
      updated_at: String(row.updated_at || ''),
      created_at: row.created_at ? String(row.created_at) : '',
    };
  });
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

// ─── Bot pause/resume ─────────────────────────────────────────────────────

export async function setBotPaused(phone: string, paused: boolean): Promise<void> {
  await ensureInit();
  await getDb().execute({
    sql: `UPDATE conversations SET bot_paused = ?, updated_at = datetime('now') WHERE phone = ?`,
    args: [paused ? 1 : 0, phone],
  });
}

export async function isBotPaused(phone: string): Promise<boolean> {
  await ensureInit();
  const result = await getDb().execute({
    sql: `SELECT bot_paused FROM conversations WHERE phone = ?`,
    args: [phone],
  });
  if (!result.rows.length) return false;
  return Number((result.rows[0] as Record<string, unknown>).bot_paused || 0) === 1;
}

// Para que el "Apendice de mensaje manual de David" quede en el history.
// role: 'assistant' para que se vea como respuesta del bot (visualmente
// no se distingue), pero metadata 'manual: true' por si despues queremos
// diferenciar.
export async function appendManualMessage(phone: string, content: string): Promise<void> {
  await ensureInit();
  const conv = await getConversation(phone);
  const history = conv?.history || [];
  history.push({ role: 'assistant', content, ts: new Date().toISOString() });
  await getDb().execute({
    sql: `UPDATE conversations SET history = ?, updated_at = datetime('now') WHERE phone = ?`,
    args: [JSON.stringify(history), phone],
  });
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

export async function listProjects(limit = 500): Promise<Project[]> {
  await ensureInit();
  // LIMIT default 500 para evitar O(N) sin techo. Si en el futuro hay mas,
  // se pasa un limit explicito o se pagina. Hoy raramente >50.
  const result = await getDb().execute({
    sql: 'SELECT * FROM projects ORDER BY updated_at DESC LIMIT ?',
    args: [limit],
  });
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

// ─── Invoices ─────────────────────────────────────────────────────────────

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface Invoice {
  id: string;
  number: string;
  client_id: string;
  client_name: string;
  project_id: string;
  issue_date: string;
  due_date: string;
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | string;
  paid_at: string;
  payment_method: string;
  notes: string;
  items: InvoiceItem[];
  created_at?: string;
  updated_at?: string;
}

function parseInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.id),
    number: String(row.number || ''),
    client_id: String(row.client_id || ''),
    client_name: String(row.client_name || ''),
    project_id: String(row.project_id || ''),
    issue_date: String(row.issue_date || ''),
    due_date: String(row.due_date || ''),
    amount: Number(row.amount || 0),
    currency: String(row.currency || 'ARS'),
    status: String(row.status || 'draft'),
    paid_at: String(row.paid_at || ''),
    payment_method: String(row.payment_method || ''),
    notes: String(row.notes || ''),
    items: safeParseArray<InvoiceItem>(row.items),
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

export async function listInvoices(limit = 500): Promise<Invoice[]> {
  await ensureInit();
  const result = await getDb().execute({
    sql: 'SELECT * FROM invoices ORDER BY issue_date DESC, created_at DESC LIMIT ?',
    args: [limit],
  });
  return result.rows.map(r => parseInvoice(r as unknown as Record<string, unknown>));
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  await ensureInit();
  const result = await getDb().execute({ sql: 'SELECT * FROM invoices WHERE id = ?', args: [id] });
  return result.rows.length ? parseInvoice(result.rows[0] as unknown as Record<string, unknown>) : null;
}

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const result = await getDb().execute({
    sql: `SELECT number FROM invoices WHERE number LIKE ? ORDER BY number DESC LIMIT 1`,
    args: [`${year}-%`],
  });
  if (result.rows.length === 0) return `${year}-0001`;
  const last = String((result.rows[0] as Record<string, unknown>).number || '');
  const match = last.match(/-(\d+)$/);
  const next = match ? Number(match[1]) + 1 : 1;
  return `${year}-${String(next).padStart(4, '0')}`;
}

export async function createInvoice(data: Partial<Invoice>): Promise<string> {
  await ensureInit();
  const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const number = data.number || (await nextInvoiceNumber());
  await getDb().execute({
    sql: `INSERT INTO invoices
          (id, number, client_id, client_name, project_id, issue_date, due_date,
           amount, currency, status, paid_at, payment_method, notes, items)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id, number, data.client_id || '', data.client_name || '', data.project_id || '',
      data.issue_date || new Date().toISOString().slice(0, 10),
      data.due_date || '',
      Number(data.amount || 0),
      data.currency || 'ARS',
      data.status || 'draft',
      data.paid_at || '',
      data.payment_method || '',
      data.notes || '',
      JSON.stringify(data.items || []),
    ],
  });
  return id;
}

export async function updateInvoice(id: string, data: Partial<Invoice>): Promise<void> {
  await ensureInit();
  const current = await getInvoice(id);
  if (!current) return;
  const merged = { ...current, ...data };
  await getDb().execute({
    sql: `UPDATE invoices SET
            number=?, client_id=?, client_name=?, project_id=?, issue_date=?, due_date=?,
            amount=?, currency=?, status=?, paid_at=?, payment_method=?, notes=?, items=?,
            updated_at=datetime('now')
          WHERE id=?`,
    args: [
      merged.number, merged.client_id, merged.client_name, merged.project_id,
      merged.issue_date, merged.due_date, Number(merged.amount || 0),
      merged.currency, merged.status, merged.paid_at, merged.payment_method,
      merged.notes, JSON.stringify(merged.items || []),
      id,
    ],
  });
}

export async function markInvoicePaid(id: string, method: string = ''): Promise<void> {
  await ensureInit();
  await getDb().execute({
    sql: `UPDATE invoices SET status='paid', paid_at=date('now'), payment_method=?, updated_at=datetime('now') WHERE id=?`,
    args: [method, id],
  });
}

export async function deleteInvoice(id: string): Promise<void> {
  await ensureInit();
  await getDb().execute({ sql: 'DELETE FROM invoices WHERE id = ?', args: [id] });
}
