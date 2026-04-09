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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

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

module.exports = { init, getConversation, upsertConversation, setContext };
