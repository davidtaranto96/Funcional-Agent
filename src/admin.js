// Catch async route errors and pass them to Express error handler (Express 4.x fix)
require('express-async-errors');

const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const db = require('./db');

const APP_VERSION = '3.2.0'; // Actualizar con cada deploy relevante

const CHANGELOG = [
  {
    version: '3.2.0',
    date: '2026-04-22',
    title: 'Sidebar Rediseñado + Presupuestos Mejorados',
    changes: [
      'Sidebar: íconos SVG minimalistas (Heroicons) reemplazan todos los emojis — se adaptan al tema claro/oscuro',
      'Sidebar: fix definitivo del desplazamiento de íconos al expandir — las secciones mantienen altura fija, los íconos no se mueven',
      'Sidebar: 72px de ancho colapsado, animación más fluida con easing ease-out',
      'Sidebar: JS previene clics accidentales durante la animación de expansión',
      'Sidebar: ícono de logout SVG (flecha de salida) reemplaza al emoji 🚪',
      'Presupuestos: se puede asociar un presupuesto a un proyecto y guardarlo como documento',
      'Presupuestos: nuevo endpoint POST /api/save-quote guarda el presupuesto en documentos del proyecto',
      'Finanzas: calculadora básica reemplazada por banner con link al módulo de Presupuestos',
    ],
  },
  {
    version: '3.1.0',
    date: '2026-04-12',
    title: 'Finanzas, Sidebar y Módulo de Presupuestos',
    changes: [
      'Módulo de Presupuestos completo: calculadora en pesos y dólares con tipo de cambio configurable',
      'Presupuestos con detalle de mano de obra, servicios, licencias y mantenimiento',
      'Vista para el cliente con beneficios, oportunidades e impresión',
      'Página de Finanzas: saldos actuales editables (Anthropic, Groq, Resend)',
      'Monitoreo de uso con presupuestos mensuales y alertas visuales (OK/Atención/Alerta)',
      'Sidebar: íconos alineados correctamente en modo colapsado, sin botón redundante',
    ],
  },
  {
    version: '3.0.0',
    date: '2026-04-12',
    title: 'Upgrade Flowlu — Dark Mode, Command Palette, Sidebar Colapsable',
    changes: [
      'Modo oscuro/claro con toggle y persistencia en localStorage',
      'Command Palette (⌘K / Ctrl+K) — buscar clientes, proyectos, tareas desde cualquier página',
      'Sidebar colapsable en desktop (modo íconos para más espacio)',
      'Barra de búsqueda rápida en el sidebar',
      'FAB (botón flotante) con acciones rápidas: nuevo proyecto, nuevo cliente, buscar',
      'Widget financiero en Dashboard — pipeline de ingresos, cobrado vs pendiente',
      'Changelog / historial de actualizaciones accesible desde configuración',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-04-11',
    title: 'Kanban Views + Centro de Control Upgrade',
    changes: [
      'Vistas Kanban con drag-and-drop para Tareas (3 columnas: Pendiente/En progreso/Completada)',
      'Kanban para Proyectos (columnas por status con drag-and-drop)',
      'Pipeline CRM con drag-and-drop entre stages',
      'Widget "Mis tareas" en Centro de Control con checkbox para completar',
      'Reuniones más prominentes con countdown y botón Meet grande',
      'SortableJS integrado para drag-and-drop nativo',
      'Sistema de toast notifications para feedback visual',
      'API endpoints JSON para operaciones kanban (task-move, project-status, client-stage)',
      'Toggle de vista Lista/Kanban en Tareas y Proyectos',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-04-10',
    title: 'Documentos + Clientes + Mejoras UI',
    changes: [
      'Módulo de Documentos (Mi Drive) con carpetas personalizadas',
      'Base de clientes con CRUD completo y vinculación a proyectos',
      'Categorías de proyectos (Cliente, Personal, Ventas, Desarrollo, Diseño)',
      'Sistema de presupuestos y estados de pago',
      'Deadlines y timeline de proyectos',
      'Sidebar rediseñado con secciones organizadas',
      'Login con Google OAuth + contraseña',
      'Responsive mobile con sidebar drawer',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-04-01',
    title: 'Lanzamiento inicial — CRM WhatsApp',
    changes: [
      'Pipeline de clientes WhatsApp con agente conversacional',
      'Generación automática de demos (Landing, WhatsApp mockup, PDF)',
      'Sistema de revisión y aprobación de demos',
      'Centro de Control con acciones pendientes',
      'Notificaciones in-app',
      'Transcripción de audios con Groq Whisper',
      'Email automático al generar demos',
      'Dashboard con métricas clave',
    ],
  },
];

// ─── Costos de servicios y precios de APIs ──────────────────────────────────

const SERVICES = [
  { key: 'railway',   name: 'Railway (hosting)',       icon: '🚂', monthly: 5,    unit: 'USD/mes',   category: 'infra',  notes: 'Hobby plan, incluye 5GB RAM + 1GB disco' },
  { key: 'turso',     name: 'Turso (database)',        icon: '🗄️', monthly: 0,    unit: 'USD/mes',   category: 'infra',  notes: 'Free tier: 9GB storage, 500 DBs' },
  { key: 'resend',    name: 'Resend (emails)',         icon: '📧', monthly: 0,    unit: 'USD/mes',   category: 'infra',  notes: 'Free tier: 100 emails/dia' },
  { key: 'meta_wa',   name: 'Meta WhatsApp API',      icon: '💬', monthly: 0,    unit: 'USD/mes',   category: 'infra',  notes: 'Free tier: 1000 conv. servicio/mes' },
  { key: 'google',    name: 'Google (OAuth+Calendar)', icon: '📅', monthly: 0,    unit: 'USD/mes',   category: 'infra',  notes: 'APIs gratis' },
  { key: 'gdrive',    name: 'Google Drive (storage)',  icon: '☁️', monthly: 0,    unit: 'USD/mes',   category: 'infra',  notes: '15GB gratis' },
  { key: 'domain',    name: 'Dominio (.com)',          icon: '🌐', monthly: 1,    unit: 'USD/mes',   category: 'infra',  notes: '~$12/año' },
];

const API_PRICING = {
  'claude-haiku-4-5': {
    name: 'Claude Haiku 4.5',
    input: 1.00,   // USD por 1M tokens input
    output: 5.00,  // USD por 1M tokens output
    uses: 'Conversaciones, reportes, mockup WhatsApp',
  },
  'claude-sonnet-4': {
    name: 'Claude Sonnet 4',
    input: 3.00,
    output: 15.00,
    uses: 'Generación de landing pages demo',
  },
  'groq-whisper': {
    name: 'Groq Whisper v3',
    input: 0.111,  // USD por hora de audio
    output: 0,
    uses: 'Transcripción de audios',
    unit: 'USD/hora',
  },
};

// Estimación de tokens por operación
const TOKEN_ESTIMATES = {
  conversation_msg:    { input: 800,  output: 400,  model: 'claude-haiku-4-5', label: 'Mensaje de conversación' },
  report_generation:   { input: 2000, output: 1500, model: 'claude-haiku-4-5', label: 'Generación de reporte' },
  landing_demo:        { input: 3000, output: 6000, model: 'claude-sonnet-4',  label: 'Demo landing page' },
  whatsapp_mockup:     { input: 1500, output: 1200, model: 'claude-haiku-4-5', label: 'Mockup WhatsApp' },
  audio_transcription: { input: 0.5,  output: 0,    model: 'groq-whisper',     label: 'Transcripción audio (min)', unit: 'minutos' },
};

const orchestrator = require('./orchestrator');
const { generateReport } = require('./reports');

// ─── Multer: upload de archivos para proyectos ───────────────────────────────

const PROJECT_FILES_DIR = path.join(__dirname, '..', 'data', 'project-files');
fs.mkdirSync(PROJECT_FILES_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = safePath(PROJECT_FILES_DIR, req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Preservar nombre original, pero sanitizar
    const safe = file.originalname.replace(/[^a-zA-Z0-9._\-áéíóúÁÉÍÓÚñÑ ]/g, '_');
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

const DOCUMENTS_DIR = path.join(__dirname, '..', 'data', 'documents');
fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = safePath(DOCUMENTS_DIR, req.params.folderId || 'general');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._\-áéíóúÁÉÍÓÚñÑ ]/g, '_');
    cb(null, safe);
  },
});
const uploadDoc = multer({ storage: docStorage, limits: { fileSize: 50 * 1024 * 1024 } });

const router = express.Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safePath(base, ...parts) {
  const resolved = path.resolve(path.join(base, ...parts));
  if (!resolved.startsWith(path.resolve(base))) throw new Error('Path traversal blocked');
  return resolved;
}

function phoneSlug(phone) { return (phone || '').replace(/[^0-9]/g, ''); }

function requireAuth(req, res, next) {
  if (req.session?.authed) return next();
  return res.redirect('/admin/login');
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const ms = Date.now() - new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'));
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

// ─── Stage / Status constants ────────────────────────────────────────────────

const STAGES = [
  { key: 'lead',         label: 'Lead',          dot: '#94a3b8', badge: 'bg-slate-100 text-slate-600' },
  { key: 'qualified',    label: 'Calificado',     dot: '#3b82f6', badge: 'bg-blue-100 text-blue-700' },
  { key: 'demo_pending', label: 'Demo pendiente', dot: '#f59e0b', badge: 'bg-amber-100 text-amber-700' },
  { key: 'demo_sent',    label: 'Demo enviado',   dot: '#6366f1', badge: 'bg-indigo-100 text-indigo-700' },
  { key: 'negotiating',  label: 'Negociando',     dot: '#a855f7', badge: 'bg-purple-100 text-purple-700' },
  { key: 'won',          label: 'Ganado',         dot: '#10b981', badge: 'bg-emerald-100 text-emerald-700' },
  { key: 'lost',         label: 'Perdido',        dot: '#f43f5e', badge: 'bg-rose-100 text-rose-700' },
  { key: 'dormant',      label: 'Dormido',        dot: '#9ca3af', badge: 'bg-gray-100 text-gray-500' },
];

const DEMO_STATUS = {
  none:               { label: '—',                  badge: 'bg-gray-100 text-gray-400' },
  generating:         { label: '⚙ Generando',        badge: 'bg-yellow-100 text-yellow-700' },
  pending_review:     { label: '👁 Para revisar',     badge: 'bg-orange-100 text-orange-700 font-semibold' },
  changes_requested:  { label: '✏ Con correcciones', badge: 'bg-violet-100 text-violet-700 font-semibold' },
  approved:           { label: '✓ Aprobado',         badge: 'bg-green-100 text-green-700' },
  sent:               { label: '✈ Enviado',          badge: 'bg-indigo-100 text-indigo-700' },
  rejected:           { label: '✗ Rechazado',        badge: 'bg-red-100 text-red-700' },
};

const PROJECT_STATUS = [
  { key: 'planning',        label: 'Planificando',       badge: 'bg-slate-100 text-slate-600',    dot: '#94a3b8' },
  { key: 'in_progress',     label: 'En curso',           badge: 'bg-blue-100 text-blue-700',      dot: '#3b82f6' },
  { key: 'waiting_client',  label: 'Esp. cliente',       badge: 'bg-amber-100 text-amber-700',    dot: '#f59e0b' },
  { key: 'waiting_payment', label: 'Esp. pago',          badge: 'bg-orange-100 text-orange-700',  dot: '#f97316' },
  { key: 'review',          label: 'En revisión',        badge: 'bg-purple-100 text-purple-700',  dot: '#a855f7' },
  { key: 'delivered',       label: 'Entregado',          badge: 'bg-emerald-100 text-emerald-700',dot: '#10b981' },
  { key: 'paused',          label: 'Pausado',            badge: 'bg-gray-100 text-gray-500',      dot: '#9ca3af' },
  { key: 'cancelled',       label: 'Cancelado',          badge: 'bg-rose-100 text-rose-700',      dot: '#f43f5e' },
];

const BUDGET_STATUS = [
  { key: 'not_quoted', label: 'Sin cotizar',      badge: 'bg-gray-100 text-gray-500' },
  { key: 'quoted',     label: 'Cotizado',         badge: 'bg-blue-100 text-blue-700' },
  { key: 'approved',   label: 'Aprobado',         badge: 'bg-green-100 text-green-700' },
  { key: 'partial',    label: 'Pago parcial',     badge: 'bg-amber-100 text-amber-700' },
  { key: 'paid',       label: 'Pagado ✓',         badge: 'bg-emerald-100 text-emerald-700' },
];

const PROJECT_CATEGORIES = [
  { key: 'cliente',     label: 'Cliente',     color: '#3b82f6', badge: 'bg-blue-100 text-blue-700',     dot: '🔵' },
  { key: 'personal',   label: 'Personal',    color: '#8b5cf6', badge: 'bg-violet-100 text-violet-700',  dot: '🟣' },
  { key: 'ventas',     label: 'Ventas',      color: '#10b981', badge: 'bg-emerald-100 text-emerald-700',dot: '🟢' },
  { key: 'desarrollo', label: 'Desarrollo',  color: '#f59e0b', badge: 'bg-amber-100 text-amber-700',    dot: '🟡' },
  { key: 'diseño',     label: 'Diseño',      color: '#ec4899', badge: 'bg-pink-100 text-pink-700',      dot: '🩷' },
  { key: 'otro',       label: 'Otro',        color: '#64748b', badge: 'bg-slate-100 text-slate-600',    dot: '⚪' },
];

const TASK_STATUS = [
  { key: 'todo',        label: 'Pendiente',    color: '#94a3b8', badge: 'bg-slate-100 text-slate-600' },
  { key: 'in_progress', label: 'En progreso',  color: '#3b82f6', badge: 'bg-blue-100 text-blue-700' },
  { key: 'done',        label: 'Completada',   color: '#10b981', badge: 'bg-emerald-100 text-emerald-700' },
];

function taskStatus(t) {
  if (t.done) return 'done';
  if (t.status === 'in_progress') return 'in_progress';
  return 'todo';
}

const CLIENT_CATEGORIES = [
  { key: 'cliente',     label: 'Cliente',     badge: 'bg-blue-100 text-blue-700' },
  { key: 'empresa',     label: 'Empresa',     badge: 'bg-indigo-100 text-indigo-700' },
  { key: 'freelancer',  label: 'Freelancer',  badge: 'bg-emerald-100 text-emerald-700' },
  { key: 'partner',     label: 'Partner',     badge: 'bg-amber-100 text-amber-700' },
  { key: 'potencial',   label: 'Potencial',   badge: 'bg-violet-100 text-violet-700' },
];

function clientCategoryBadge(key) {
  const c = CLIENT_CATEGORIES.find(x => x.key === key) || CLIENT_CATEGORIES[0];
  return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${c.badge}">${c.label}</span>`;
}

function categoryBadge(key) {
  const c = PROJECT_CATEGORIES.find(x => x.key === key) || PROJECT_CATEGORIES[0];
  return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${c.badge}">${c.dot} ${c.label}</span>`;
}

function stageBadge(key) {
  const s = STAGES.find(x => x.key === key) || STAGES[0];
  return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}">${s.label}</span>`;
}
function demoStatusBadge(key) {
  const s = DEMO_STATUS[key] || DEMO_STATUS.none;
  return `<span class="px-2 py-0.5 rounded-full text-xs ${s.badge}">${s.label}</span>`;
}
function projectStatusBadge(key) {
  const s = PROJECT_STATUS.find(x => x.key === key) || PROJECT_STATUS[0];
  return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}">${s.label}</span>`;
}
function budgetStatusBadge(key) {
  const s = BUDGET_STATUS.find(x => x.key === key) || BUDGET_STATUS[0];
  return `<span class="px-2 py-0.5 rounded-full text-xs ${s.badge}">${s.label}</span>`;
}

// ─── Process checklist for a WA client ──────────────────────────────────────

function processSteps(conv) {
  const hasEvent = e => (conv.timeline || []).some(x => x.event === e);
  const ds = conv.demo_status || 'none';
  return [
    { label: 'Conversación iniciada',   done: true },
    { label: 'Datos recopilados',       done: conv.stage === 'done' || !!conv.report },
    { label: 'Reporte generado',        done: !!conv.report },
    { label: 'Demo generado',           done: !!ds && !['none','generating'].includes(ds) },
    // Approved = ok (blue). Corrections/rejected = warning (amber). Pending = not done (gray).
    { label: 'Aprobado por David',      done: ['approved','sent'].includes(ds),
      warn: ['changes_requested','rejected'].includes(ds),
      warnLabel: ds === 'rejected' ? 'Rechazada — regenerando' : 'Con correcciones' },
    { label: 'Enviado al cliente',      done: ds === 'sent' || hasEvent('demo_sent_to_client') },
    { label: 'Reunión / negociación',   done: ['negotiating','won'].includes(conv.client_stage) },
    { label: 'Proyecto ganado',         done: conv.client_stage === 'won' },
  ];
}

// ─── Timeline icons ──────────────────────────────────────────────────────────

function timelineIcon(ev) {
  const map = {
    report_generated: '📄', demo_generating: '⚙', demo_ready: '🎨',
    demo_approved: '✅', demo_sent_to_client: '📤', demo_rejected: '❌',
    stage_changed: '🔄', client_requested_change: '✏️', followup_sent: '🔔',
  };
  return map[ev] || '📍';
}

// ─── Layout ──────────────────────────────────────────────────────────────────

// ─── SVG icon set (Heroicons outline, stroke="currentColor") ───────────────────
const NAV_ICONS = {
  dashboard:   `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  clients:     `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591L15.75 12.75V21l-7.5-3V12.75L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"/></svg>`,
  control:     `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/></svg>`,
  clientes:    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`,
  projects:    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"/></svg>`,
  tasks:       `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  finanzas:    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg>`,
  presupuesto: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>`,
  documentos:  `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>`,
  changelog:   `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>`,
};
const LOGOUT_ICON = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/></svg>`;

function layout(title, body, { pendingCount = 0, notifCount = 0, activePage = '', user = null } = {}) {
  // Section label: ALWAYS same height (20px). Collapsed shows divider line, expanded shows text.
  // This keeps icon Y-positions identical in both states → no shift on hover expand.
  const sectionLabel = (name) =>
    `<div class="sidebar-section-label flex items-center" style="height:20px;margin-bottom:4px;padding:0 4px">
      <span class="sidebar-section-text text-[10px] font-semibold text-slate-600 uppercase tracking-widest leading-none">${name}</span>
      <div class="sidebar-section-divider" style="flex:1;height:1px;background:rgba(255,255,255,0.07);display:none"></div>
    </div>`;

  const navItem = (href, icon, label, page) => {
    const active = activePage === page;
    let badge = '';
    if (page === 'clients' && pendingCount > 0) badge = `<span class="sidebar-badge bg-orange-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center animate-pulse">${pendingCount}</span>`;
    if (page === 'control' && notifCount > 0) badge = `<span class="sidebar-badge bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">${notifCount}</span>`;
    return `<a href="${href}" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/8 hover:text-slate-100'}">
      <span class="flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center ${active ? 'text-white' : 'text-slate-400'}">${icon}</span>
      <span class="flex-1 sidebar-label whitespace-nowrap overflow-hidden">${label}</span>
      ${badge}
    </a>`;
  };

  const userName = user?.name || '';
  const userEmail = user?.email || '';
  const userPhoto = user?.photo || '';
  const userInitial = (userName || userEmail || 'D')[0].toUpperCase();

  const userBlock = `
    <div class="mx-3 mb-2 p-2.5 bg-white/5 rounded-xl border border-white/5 hover:bg-white/8 transition-colors cursor-default">
      <div class="flex items-center gap-2.5">
        ${userPhoto
          ? `<img src="${userPhoto}" class="w-7 h-7 rounded-full flex-shrink-0 ring-2 ring-blue-500/30" alt="">`
          : `<div class="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">${userInitial}</div>`}
        <div class="min-w-0 flex-1 sidebar-user-info">
          <div class="text-xs font-semibold text-slate-200 truncate leading-tight">${escapeHtml(userName || 'David Taranto')}</div>
          ${userEmail ? `<div class="text-[10px] text-slate-500 truncate leading-tight">${escapeHtml(userEmail)}</div>` : '<div class="text-[10px] text-slate-500 leading-tight">Admin</div>'}
        </div>
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
  <title>${escapeHtml(title)} · DT Systems</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js"></script>
  <style>
    /* ──────────────────────────────────────────────────────────────
       PRECISION DARK — Design System Tokens
       ────────────────────────────────────────────────────────────── */
    :root{
      /* Accents (OKLCH) */
      --accent:      oklch(62% 0.2 250);
      --accent-dim:  oklch(62% 0.2 250 / 0.13);
      --accent-glow: oklch(62% 0.2 250 / 0.28);
      --green:       oklch(62% 0.16 160);
      --green-dim:   oklch(62% 0.16 160 / 0.13);
      --amber:       oklch(68% 0.17 65);
      --amber-dim:   oklch(68% 0.17 65 / 0.13);
      --red:         oklch(58% 0.2 20);
      --red-dim:     oklch(58% 0.2 20 / 0.13);
      --purple:      oklch(62% 0.18 290);
      --purple-dim:  oklch(62% 0.18 290 / 0.13);
      /* Backgrounds */
      --bg-app:      #060d19;
      --bg-card:     #0d1b2e;
      --bg-card2:    #101e33;
      --bg-inset:    #091525;
      --bg-input:    #0a1628;
      /* Borders */
      --border:      rgba(255,255,255,0.065);
      --border-s:    rgba(255,255,255,0.11);
      /* Text */
      --text-1:      #eef2ff;
      --text-2:      #8b9ab5;
      --text-3:      #3d5070;
      /* Shadows */
      --shadow-sm:   0 1px 3px rgba(0,0,0,.4), 0 2px 8px rgba(0,0,0,.25);
      --shadow-md:   0 4px 16px rgba(0,0,0,.5), 0 8px 32px rgba(0,0,0,.3);
      --shadow-lg:   0 16px 64px rgba(0,0,0,.7);
      /* Radii */
      --r-sm: 6px;
      --r-md: 10px;
      --r-lg: 14px;
      --r-xl: 20px;
      /* Type */
      --font: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --mono: 'Geist Mono', 'SF Mono', ui-monospace, monospace;
      /* Sidebar width */
      --sw: 240px;
    }
    /* Base */
    html,body{font-family:var(--font)}
    body{font-feature-settings:'cv02','cv03','cv04','cv11','ss01','ss02';-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color:var(--text-1)}
    .font-mono,.mono{font-family:var(--mono)!important}
    /* Subtle noise texture (Precision Dark signature) */
    body::before{
      content:"";position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.35;
      background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='2' seed='2'/><feColorMatrix values='0 0 0 0 .55 0 0 0 0 .65 0 0 0 0 .85 0 0 0 .025 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
    }
    /* Scrollbars */
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:var(--border-s);border-radius:3px}
    ::-webkit-scrollbar-thumb:hover{background:var(--text-3)}

    /* ──────────────────────────────────────────────────────────────
       Keyframes
       ────────────────────────────────────────────────────────────── */
    @keyframes spin       { to{transform:rotate(360deg)} }
    @keyframes shimmer    { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
    @keyframes fade-in    { from{opacity:0} to{opacity:1} }
    @keyframes slide-in   { from{transform:translateX(100%)} to{transform:translateX(0)} }
    @keyframes modal-in   { from{opacity:0;transform:scale(.94) translateY(-8px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes toast-in   { from{opacity:0;transform:translateY(10px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes page-in    { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
    @keyframes count-up   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes bubble-in  { from{opacity:0;transform:translateY(8px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes pop-in     { 0%{transform:scale(.7);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
    @keyframes win-burst  { 0%{transform:scale(1)} 30%{transform:scale(1.15)} 60%{transform:scale(.95)} 100%{transform:scale(1)} }
    .spin{animation:spin 1s linear infinite}
    .page-enter{animation:page-in .22s ease forwards}
    @media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}

    /* ──────────────────────────────────────────────────────────────
       Utility classes (Precision Dark surface system)
       ────────────────────────────────────────────────────────────── */
    .pd-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-sm)}
    .pd-card2{background:var(--bg-card2);border:1px solid var(--border);border-radius:var(--r-md)}
    .pd-inset{background:var(--bg-inset)}
    .pd-divider{height:1px;background:var(--border);margin:12px 0}
    /* Buttons */
    .pd-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 14px;border-radius:var(--r-md);font-size:13px;font-weight:500;color:var(--text-1);background:var(--bg-card2);border:1px solid var(--border-s);cursor:pointer;transition:all .15s;text-decoration:none;line-height:1}
    .pd-btn:hover{background:var(--bg-inset);border-color:var(--border-s)}
    .pd-btn-primary{background:var(--accent);border-color:var(--accent);color:#fff}
    .pd-btn-primary:hover{filter:brightness(1.1);box-shadow:0 0 0 3px var(--accent-dim)}
    .pd-btn-ghost{background:transparent;border-color:transparent;color:var(--text-2)}
    .pd-btn-ghost:hover{color:var(--text-1);background:var(--bg-inset)}
    .pd-btn-danger{background:var(--red);border-color:var(--red);color:#fff}
    .pd-btn-danger:hover{filter:brightness(1.1)}
    .pd-btn-sm{padding:5px 10px;font-size:12px}
    .pd-btn-icon{padding:7px;width:32px;height:32px}
    /* Badges */
    .pd-badge{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;padding:3px 8px;border-radius:5px;letter-spacing:.3px;text-transform:uppercase;background:var(--bg-inset);color:var(--text-2);border:1px solid var(--border)}
    /* Inputs */
    .pd-input{width:100%;background:var(--bg-input);border:1px solid var(--border-s);color:var(--text-1);padding:9px 12px;border-radius:var(--r-md);font-size:13px;font-family:var(--font);outline:none;transition:all .15s}
    .pd-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-dim)}
    .pd-input::placeholder{color:var(--text-3)}
    /* Tables */
    .pd-table{width:100%;border-collapse:collapse;font-size:13px}
    .pd-table th{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-3);padding:10px 14px;text-align:left;border-bottom:1px solid var(--border);background:var(--bg-inset)}
    .pd-table td{padding:12px 14px;border-bottom:1px solid var(--border);color:var(--text-1)}
    .pd-table tr{transition:background .1s}
    .pd-table tbody tr:hover{background:var(--bg-inset)}
    /* Tabs */
    .pd-tabs{display:flex;gap:4px;border-bottom:1px solid var(--border)}
    .pd-tab{padding:10px 14px;font-size:13px;font-weight:500;color:var(--text-2);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;background:transparent;border-left:0;border-right:0;border-top:0}
    .pd-tab:hover{color:var(--text-1)}
    .pd-tab.active{color:var(--accent);border-bottom-color:var(--accent)}
    /* Skeleton */
    .pd-skeleton{background:linear-gradient(90deg,var(--bg-inset) 25%,var(--border) 50%,var(--bg-inset) 75%);background-size:800px 100%;animation:shimmer 1.6s infinite;border-radius:var(--r-sm)}
    /* Modal */
    .pd-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:90;display:flex;align-items:center;justify-content:center;padding:20px;animation:fade-in .15s ease}
    .pd-modal{background:var(--bg-card);border:1px solid var(--border-s);border-radius:var(--r-lg);box-shadow:var(--shadow-lg);max-width:600px;width:100%;padding:28px;animation:modal-in .22s cubic-bezier(.34,1.56,.64,1)}
    /* Drawer (right slide-in) */
    .pd-drawer-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:80;animation:fade-in .15s ease}
    .pd-drawer{position:fixed;top:0;right:0;bottom:0;width:560px;max-width:96vw;background:var(--bg-card);border-left:1px solid var(--border-s);box-shadow:var(--shadow-lg);z-index:81;animation:slide-in .25s cubic-bezier(.4,0,.2,1);overflow-y:auto}
    /* Checkbox */
    .pd-check{width:16px;height:16px;border:1.5px solid var(--border-s);border-radius:4px;background:var(--bg-input);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
    .pd-check.on{background:var(--accent);border-color:var(--accent);color:#fff}
    /* Stage / status colored dots */
    .pd-dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0}

    /* ──────────────────────────────────────────────────────────────
       Legacy classes (kept for backward compat during migration)
       ────────────────────────────────────────────────────────────── */
    .nav-active{background:rgba(59,130,246,0.15)!important}
    .card-hover{transition:box-shadow 0.2s,transform 0.2s}
    .card-hover:hover{box-shadow:var(--shadow-md);transform:translateY(-2px)}
    /* Toast notifications (legacy — fixed bottom-right; new pd-toast lives bottom-center, see .pd-toast-wrap) */
    .toast{position:fixed;bottom:24px;right:24px;z-index:999;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:500;color:white;opacity:0;transform:translateY(20px);transition:all .3s ease;max-width:320px}
    .toast.show{opacity:1;transform:translateY(0)}
    .toast-success{background:oklch(30% .12 160);border:1px solid oklch(40% .14 160)}
    .toast-error{background:oklch(28% .15 20);border:1px solid oklch(38% .17 20)}
    /* Kanban */
    .kanban-ghost{opacity:.4;background:var(--accent-dim)!important;border-radius:12px;border:1.5px dashed var(--accent)!important}
    .kanban-drag{box-shadow:var(--shadow-md);transform:rotate(1.5deg);z-index:100}
    .kanban-col{min-height:120px;transition:background .2s,border-color .2s}
    .kanban-col.sortable-chosen-hover{background:var(--accent-dim);border-color:var(--accent)}
    .kanban-card{transition:box-shadow .2s,transform .15s,border-color .2s}
    .kanban-card:hover{box-shadow:var(--shadow-sm);transform:translateY(-1px);border-color:var(--border-s)}
    .kanban-empty{border:1.5px dashed var(--border-s);border-radius:12px;padding:24px;text-align:center;color:var(--text-3);font-size:13px}
    /* View toggle */
    .view-toggle .active{background:var(--accent);color:#fff}
    .view-toggle button{padding:6px 14px;border-radius:8px;font-size:13px;font-weight:500;transition:all .15s}
    #sidebar{transition:transform 0.28s cubic-bezier(.4,0,.2,1)}
    #sidebar-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:19;opacity:0;visibility:hidden;transition:opacity 0.28s ease,visibility 0.28s ease}
    #sidebar-backdrop.open{opacity:1;visibility:visible}
    @media(max-width:767px){
      #sidebar{transform:translateX(-100%)}
      #sidebar.open{transform:translateX(0)}
      #main-wrapper{margin-left:0!important}
    }
    /* ── Dark Mode legacy overrides (kept until per-view migration) ── */
    html.dark body{background:var(--bg-app)!important;color:var(--text-1)}
    html.dark .bg-white{background-color:var(--bg-card)!important}
    html.dark .bg-slate-50\/80,html.dark .bg-slate-50{background-color:var(--bg-inset)!important}
    html.dark .border-slate-200{border-color:var(--border-s)!important}
    html.dark .border-slate-100{border-color:var(--border)!important}
    html.dark .divide-slate-100>*+*{border-color:var(--border)!important}
    html.dark .text-slate-900,html.dark .text-slate-800{color:var(--text-1)!important}
    html.dark .text-slate-700{color:var(--text-1)!important}
    html.dark .text-slate-600{color:var(--text-2)!important}
    html.dark .text-slate-500{color:var(--text-2)!important}
    html.dark .text-slate-400{color:var(--text-3)!important}
    html.dark .hover\:bg-slate-50:hover{background-color:var(--bg-inset)!important}
    html.dark .hover\:bg-slate-50\/50:hover{background-color:var(--bg-inset)!important}
    html.dark input:not([type="checkbox"]):not([type="radio"]):not(.no-dark),html.dark textarea,html.dark select{background-color:var(--bg-input)!important;border-color:var(--border-s)!important;color:var(--text-1)!important}
    html.dark input::placeholder,html.dark textarea::placeholder{color:var(--text-3)!important}
    html.dark ::-webkit-scrollbar-track{background:transparent}
    html.dark ::-webkit-scrollbar-thumb{background:var(--border-s)}
    html.dark .kanban-card{background:var(--bg-card2)!important;border-color:var(--border)!important}
    html.dark .kanban-empty{border-color:var(--border-s)!important;color:var(--text-3)!important}
    html.dark .kanban-ghost{background:var(--accent-dim)!important}
    html.dark .kanban-col.sortable-chosen-hover{background:var(--accent-dim)!important;border-color:var(--accent)!important}
    html.dark .bg-slate-100{background-color:var(--bg-inset)!important}
    html.dark .bg-slate-100.text-slate-600{color:var(--text-2)!important}
    html.dark .bg-gray-100{background-color:var(--bg-inset)!important}
    html.dark .bg-gray-100.text-gray-400,html.dark .bg-gray-100.text-gray-500{color:var(--text-3)!important}
    html.dark .bg-orange-50{background-color:var(--amber-dim)!important}
    html.dark .bg-blue-50{background-color:var(--accent-dim)!important}
    html.dark .bg-emerald-50{background-color:var(--green-dim)!important}
    html.dark .bg-red-50{background-color:var(--red-dim)!important}
    html.dark .toast-success{background:oklch(30% .12 160);border:1px solid oklch(40% .14 160)}
    html.dark .toast-error{background:oklch(28% .15 20);border:1px solid oklch(38% .17 20)}
    html.dark #sidebar{background:var(--bg-card)!important;border-color:var(--border)!important}
    html.dark .card-hover:hover{box-shadow:var(--shadow-md)}
    /* ── Command Palette ── */
    .cmd-palette{position:fixed;inset:0;z-index:1000;display:none;align-items:flex-start;justify-content:center;padding-top:min(20vh,160px)}
    .cmd-palette.open{display:flex}
    .cmd-backdrop{position:absolute;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
    .cmd-box{position:relative;width:100%;max-width:560px;margin:0 16px;background:white;border-radius:16px;box-shadow:0 25px 60px rgba(0,0,0,0.3);overflow:hidden;animation:cmd-in .15s ease}
    html.dark .cmd-box{background:#1a2236;border:1px solid #1e3050}
    @keyframes cmd-in{from{opacity:0;transform:scale(0.96) translateY(-8px)}to{opacity:1;transform:scale(1) translateY(0)}}
    .cmd-input{width:100%;border:none;outline:none;padding:16px 20px 16px 48px;font-size:15px;background:transparent;color:#1e293b}
    html.dark .cmd-input{color:#e2e8f0}
    .cmd-input::placeholder{color:#94a3b8}
    .cmd-results{max-height:360px;overflow-y:auto;border-top:1px solid #e2e8f0}
    html.dark .cmd-results{border-top-color:#1e3050}
    .cmd-item{display:flex;align-items:center;gap:12px;padding:10px 20px;cursor:pointer;transition:background .1s;font-size:13px;color:#475569}
    .cmd-item:hover,.cmd-item.active{background:#f1f5f9}
    html.dark .cmd-item{color:#94a3b8}
    html.dark .cmd-item:hover,html.dark .cmd-item.active{background:#162032}
    .cmd-item .cmd-type{font-size:10px;padding:2px 8px;border-radius:6px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;flex-shrink:0}
    .cmd-empty{padding:32px 20px;text-align:center;color:#94a3b8;font-size:13px}
    .cmd-footer{display:flex;align-items:center;gap:16px;padding:10px 20px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}
    html.dark .cmd-footer{border-top-color:#1e3050}
    .cmd-footer kbd{background:#f1f5f9;border:1px solid #e2e8f0;padding:2px 6px;border-radius:4px;font-family:inherit;font-size:10px}
    html.dark .cmd-footer kbd{background:#0f172a;border-color:#1e3050;color:#64748b}
    /* ── FAB ── */
    .fab-container{position:fixed;bottom:24px;right:24px;z-index:50}
    .fab-btn{width:52px;height:52px;border-radius:16px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:white;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(59,130,246,0.4);transition:all .2s}
    .fab-btn:hover{transform:scale(1.05);box-shadow:0 12px 32px rgba(59,130,246,0.5)}
    .fab-btn svg{transition:transform .2s}
    .fab-menu{position:absolute;bottom:60px;right:0;background:white;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.15);border:1px solid #e2e8f0;padding:6px;min-width:200px;opacity:0;visibility:hidden;transform:translateY(8px) scale(0.95);transition:all .15s ease}
    .fab-menu.open{opacity:1;visibility:visible;transform:translateY(0) scale(1)}
    html.dark .fab-menu{background:#1a2236;border-color:#1e3050;box-shadow:0 12px 40px rgba(0,0,0,0.4)}
    .fab-menu a{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:500;color:#475569;text-decoration:none;transition:background .1s}
    .fab-menu a:hover{background:#f1f5f9}
    html.dark .fab-menu a{color:#94a3b8}
    html.dark .fab-menu a:hover{background:#162032}
    .fab-menu a span.fab-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
    /* ── Sidebar collapse (desktop) ── */
    @media(min-width:768px){
      #sidebar{transition:width .2s cubic-bezier(.25,.46,.45,.94),box-shadow .2s ease}
      body.sidebar-collapsed #sidebar{width:72px!important;overflow:visible}
      body.sidebar-collapsed #main-wrapper{margin-left:72px!important;transition:margin-left .2s cubic-bezier(.25,.46,.45,.94)}
      /* ─ Section label: swap text↔divider line (same 20px height → icons never shift) ─ */
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-section-text{display:none!important}
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-section-divider{display:block!important}
      /* ─ Text labels hidden (inline in flex row — no height impact) ─ */
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-label,
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-user-info,
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-brand-text,
      body.sidebar-collapsed #sidebar:not(:hover) #darkToggle,
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-badge{display:none!important}
      /* ─ Nav items: center icon (gap:0 prevents gap-3 from offsetting icon) ─ */
      body.sidebar-collapsed #sidebar:not(:hover) nav a{justify-content:center;gap:0;padding:10px 0}
      /* ─ Search: icon-only (same height as full bar → no vertical shift) ─ */
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-search{padding:6px 8px}
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-search button{justify-content:center;padding:7px 0}
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-search button>span,
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-search button kbd{display:none}
      /* ─ Brand ─ */
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-brand{padding:14px 0;display:flex;justify-content:center;align-items:center}
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-brand>div{justify-content:center;gap:0}
      /* ─ Bottom ─ */
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-bottom{padding:8px 4px}
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-bottom .mx-3{margin:0;padding:6px 0;display:flex;justify-content:center;align-items:center;background:transparent!important;border:none!important;border-radius:0}
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-bottom .mx-3>div{justify-content:center;gap:0}
      body.sidebar-collapsed #sidebar:not(:hover) .sidebar-bottom form button{justify-content:center;padding:8px 0;gap:0}
      /* ─ Hover expand as overlay ─ */
      body.sidebar-collapsed #sidebar:hover{width:240px!important;box-shadow:8px 0 40px rgba(0,0,0,0.3);z-index:30}
    }
  </style>
</head>
<body class="min-h-screen" style="display:flex;background:var(--bg-app);color:var(--text-1)">
  <aside id="sidebar" style="width:240px;min-height:100vh;position:fixed;top:0;left:0;z-index:20;background:var(--bg-card);border-right:1px solid var(--border)" class="flex flex-col">
    <!-- Brand -->
    <div class="px-4 py-4 border-b border-white/5 sidebar-brand">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-900/40">
          <span class="text-white text-[11px] font-black tracking-tight">DT</span>
        </div>
        <div class="flex-1 min-w-0 sidebar-brand-text">
          <div class="text-sm font-bold text-white tracking-tight leading-tight">DT Systems</div>
          <div class="text-[10px] text-slate-500 leading-none mt-0.5">CRM & Proyectos · <span class="text-slate-600">v${APP_VERSION}</span></div>
        </div>
        <button onclick="toggleDarkMode()" id="darkToggle" class="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0" title="Tema claro/oscuro">
          <svg id="darkIcon" class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/></svg>
        </button>
      </div>
    </div>

    <!-- Search trigger -->
    <div class="px-3 pt-3 pb-1 sidebar-search">
      <button onclick="openCmdPalette()" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors cursor-pointer group">
        <svg class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <span class="text-xs text-slate-500 flex-1 text-left">Buscar...</span>
        <kbd class="text-[9px] text-slate-600 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </button>
    </div>
    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto py-3 px-3 space-y-4">
      <div>
        ${sectionLabel('General')}
        <div class="space-y-0.5">
          ${navItem('/admin', NAV_ICONS.dashboard, 'Dashboard', 'dashboard')}
        </div>
      </div>
      <div>
        ${sectionLabel('Clientes')}
        <div class="space-y-0.5">
          ${navItem('/admin/clients', NAV_ICONS.clients, 'Pipeline', 'clients')}
          ${navItem('/admin/control', NAV_ICONS.control, 'Centro de Control', 'control')}
          ${navItem('/admin/clientes', NAV_ICONS.clientes, 'Clientes', 'clientes')}
        </div>
      </div>
      <div>
        ${sectionLabel('Trabajo')}
        <div class="space-y-0.5">
          ${navItem('/admin/projects', NAV_ICONS.projects, 'Proyectos', 'projects')}
          ${navItem('/admin/tasks', NAV_ICONS.tasks, 'Tareas', 'tasks')}
        </div>
      </div>
      <div>
        ${sectionLabel('Finanzas')}
        <div class="space-y-0.5">
          ${navItem('/admin/finanzas', NAV_ICONS.finanzas, 'Finanzas', 'finanzas')}
          ${navItem('/admin/presupuesto', NAV_ICONS.presupuesto, 'Presupuestos', 'presupuesto')}
        </div>
      </div>
      <div>
        ${sectionLabel('Recursos')}
        <div class="space-y-0.5">
          ${navItem('/admin/documentos', NAV_ICONS.documentos, 'Documentos', 'documentos')}
          ${navItem('/admin/changelog', NAV_ICONS.changelog, 'Actualizaciones', 'changelog')}
        </div>
      </div>
    </nav>

    <!-- User + Logout -->
    <div class="pb-3 border-t border-slate-700/40 pt-3 sidebar-bottom">
      ${userBlock}
      <form method="POST" action="/admin/logout" class="px-3">
        <button class="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors w-full px-3 py-2 rounded-xl hover:bg-slate-800">
          <span class="flex-shrink-0 text-slate-500">${LOGOUT_ICON}</span>
          <span class="sidebar-label">Cerrar sesión</span>
        </button>
      </form>
    </div>
  </aside>
  <div id="main-wrapper" style="margin-left:240px;flex:1;min-height:100vh">
    <div class="md:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-10" style="background:var(--bg-card);border-bottom:1px solid var(--border)">
      <button onclick="toggleSidebar()" class="text-white p-1.5 rounded-lg hover:bg-white/10">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <span class="text-white text-[9px] font-black">DT</span>
        </div>
        <span class="text-white text-sm font-bold">DT Systems</span>
      </div>
    </div>
    <main class="max-w-7xl mx-auto px-4 py-4 md:px-6 md:py-6 pb-16 min-h-screen">${body}</main>
  </div>
  <div id="sidebar-backdrop" onclick="closeSidebar()"></div>

  <!-- Command Palette -->
  <div id="cmdPalette" class="cmd-palette" onclick="if(event.target===this||event.target.classList.contains('cmd-backdrop'))closeCmdPalette()">
    <div class="cmd-backdrop"></div>
    <div class="cmd-box">
      <div style="position:relative">
        <svg class="w-4 h-4 text-slate-400" style="position:absolute;left:18px;top:50%;transform:translateY(-50%)" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input id="cmdInput" class="cmd-input" placeholder="Buscar clientes, proyectos, tareas..." autocomplete="off" spellcheck="false">
      </div>
      <div id="cmdResults" class="cmd-results"></div>
      <div class="cmd-footer">
        <span><kbd>↑↓</kbd> navegar</span>
        <span><kbd>↵</kbd> abrir</span>
        <span><kbd>esc</kbd> cerrar</span>
      </div>
    </div>
  </div>

  <!-- FAB Quick Actions -->
  <div class="fab-container">
    <div id="fabMenu" class="fab-menu">
      <a href="/admin/projects/new"><span class="fab-icon bg-blue-100 text-blue-600">📁</span>Nuevo proyecto</a>
      <a href="/admin/clientes/new"><span class="fab-icon bg-emerald-100 text-emerald-600">👤</span>Nuevo cliente</a>
      <a href="/admin/clients" onclick="event.preventDefault();document.getElementById('fabMenu').classList.remove('open');openCmdPalette()"><span class="fab-icon bg-purple-100 text-purple-600">🔍</span>Buscar <kbd class="text-[9px] ml-auto bg-slate-100 border border-slate-200 px-1 rounded">⌘K</kbd></a>
    </div>
    <button class="fab-btn" onclick="toggleFab()" id="fabBtn" title="Acciones rapidas">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
    </button>
  </div>

  <script>
  // ── Sidebar ──
  function toggleSidebar(){
    const s=document.getElementById('sidebar');
    const b=document.getElementById('sidebar-backdrop');
    const isOpen=s.classList.contains('open');
    if(isOpen){closeSidebar();}else{
      s.classList.add('open');
      b.classList.add('open');
      document.body.style.overflow='hidden';
    }
  }
  function closeSidebar(){
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-backdrop').classList.remove('open');
    document.body.style.overflow='';
  }

  // ── Sidebar collapse (desktop) ──
  function collapseSidebar(){
    if(window.innerWidth<768)return;
    document.body.classList.add('sidebar-collapsed');
    localStorage.setItem('dt-sidebar','collapsed');
  }
  function expandSidebar(){
    document.body.classList.remove('sidebar-collapsed');
    localStorage.setItem('dt-sidebar','expanded');
  }
  // Click outside sidebar → collapse
  document.getElementById('main-wrapper').addEventListener('click',function(){
    if(window.innerWidth>=768&&!document.body.classList.contains('sidebar-collapsed')){
      collapseSidebar();
    }
  });
  // Init from localStorage
  (function(){
    if(window.innerWidth>=768){
      var pref=localStorage.getItem('dt-sidebar');
      if(pref==='collapsed'||pref===null){
        document.body.classList.add('sidebar-collapsed');
      }
    }
  })();

  // ── Sidebar hover: block nav clicks during expand animation so hover target stays correct ──
  (function(){
    var sb=document.getElementById('sidebar');
    if(!sb)return;
    var links=[],timer,busy=false;
    sb.addEventListener('mouseenter',function(){
      if(!document.body.classList.contains('sidebar-collapsed')||busy)return;
      busy=true;
      links=Array.from(sb.querySelectorAll('nav a'));
      links.forEach(function(a){a.style.pointerEvents='none'});
      timer=setTimeout(function(){
        links.forEach(function(a){a.style.pointerEvents=''});
        busy=false;
      },220);
    });
    sb.addEventListener('mouseleave',function(){
      clearTimeout(timer);
      links.forEach(function(a){a.style.pointerEvents=''});
      busy=false;
    });
  })();

  // ── Dark Mode ──
  function initDarkMode(){
    var pref=localStorage.getItem('dt-theme');
    if(pref==='dark'||(pref===null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){
      document.documentElement.classList.add('dark');
    }
    updateDarkIcon();
  }
  function toggleDarkMode(){
    document.documentElement.classList.toggle('dark');
    var isDark=document.documentElement.classList.contains('dark');
    localStorage.setItem('dt-theme',isDark?'dark':'light');
    updateDarkIcon();
    showToast(isDark?'Modo oscuro activado':'Modo claro activado');
  }
  function updateDarkIcon(){
    var icon=document.getElementById('darkIcon');
    if(!icon)return;
    var isDark=document.documentElement.classList.contains('dark');
    icon.innerHTML=isDark
      ?'<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/>'
      :'<path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/>';
  }
  initDarkMode();

  // ── Toast ──
  function showToast(msg,type){
    type=type||'success';
    var t=document.createElement('div');
    t.className='toast toast-'+type;
    t.textContent=msg;
    document.body.appendChild(t);
    requestAnimationFrame(function(){t.classList.add('show');});
    setTimeout(function(){t.classList.remove('show');setTimeout(function(){t.remove();},300);},3000);
  }

  // ── Command Palette ──
  var _cmdData=null;
  var _cmdIdx=-1;
  function openCmdPalette(){
    var p=document.getElementById('cmdPalette');
    p.classList.add('open');
    var inp=document.getElementById('cmdInput');
    inp.value='';
    inp.focus();
    _cmdIdx=-1;
    if(!_cmdData){
      document.getElementById('cmdResults').innerHTML='<div class="cmd-empty">Cargando...</div>';
      fetch('/admin/api/search-index').then(function(r){return r.json()}).then(function(d){
        _cmdData=d;
        renderCmdResults('');
      }).catch(function(){
        document.getElementById('cmdResults').innerHTML='<div class="cmd-empty">Error cargando datos</div>';
      });
    } else {
      renderCmdResults('');
    }
  }
  function closeCmdPalette(){
    document.getElementById('cmdPalette').classList.remove('open');
  }
  function renderCmdResults(q){
    var box=document.getElementById('cmdResults');
    if(!_cmdData){box.innerHTML='<div class="cmd-empty">Cargando...</div>';return;}
    q=(q||'').toLowerCase().trim();
    var items=_cmdData.filter(function(it){
      if(!q)return true;
      return (it.title||'').toLowerCase().includes(q)||(it.sub||'').toLowerCase().includes(q)||(it.type||'').toLowerCase().includes(q);
    }).slice(0,12);
    if(items.length===0){
      box.innerHTML='<div class="cmd-empty">Sin resultados para "'+q+'"</div>';
      return;
    }
    var typeColors={client:'bg-blue-100 text-blue-700',project:'bg-purple-100 text-purple-700',task:'bg-amber-100 text-amber-700',page:'bg-slate-100 text-slate-600'};
    var typeLabels={client:'Cliente',project:'Proyecto',task:'Tarea',page:'Pagina'};
    box.innerHTML=items.map(function(it,i){
      var tc=typeColors[it.type]||'bg-slate-100 text-slate-600';
      var tl=typeLabels[it.type]||it.type;
      return '<a href="'+it.href+'" class="cmd-item'+(i===_cmdIdx?' active':'')+'" data-idx="'+i+'">'+
        '<span class="text-base flex-shrink-0">'+(it.icon||'•')+'</span>'+
        '<div class="flex-1 min-w-0"><div class="text-sm font-medium" style="color:inherit">'+it.title+'</div>'+(it.sub?'<div class="text-[11px] opacity-60 truncate">'+it.sub+'</div>':'')+'</div>'+
        '<span class="cmd-type '+tc+'">'+tl+'</span></a>';
    }).join('');
  }
  document.addEventListener('keydown',function(e){
    // Cmd+K / Ctrl+K
    if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();openCmdPalette();return;}
    if(e.key==='Escape'){
      if(document.getElementById('cmdPalette').classList.contains('open')){closeCmdPalette();return;}
      closeSidebar();
    }
    // Arrow navigation in command palette
    var p=document.getElementById('cmdPalette');
    if(!p.classList.contains('open'))return;
    var items=document.querySelectorAll('#cmdResults .cmd-item');
    if(e.key==='ArrowDown'){e.preventDefault();_cmdIdx=Math.min(_cmdIdx+1,items.length-1);items.forEach(function(el,i){el.classList.toggle('active',i===_cmdIdx)});if(items[_cmdIdx])items[_cmdIdx].scrollIntoView({block:'nearest'});}
    if(e.key==='ArrowUp'){e.preventDefault();_cmdIdx=Math.max(_cmdIdx-1,0);items.forEach(function(el,i){el.classList.toggle('active',i===_cmdIdx)});if(items[_cmdIdx])items[_cmdIdx].scrollIntoView({block:'nearest'});}
    if(e.key==='Enter'&&items[_cmdIdx]){e.preventDefault();items[_cmdIdx].click();}
  });
  var cmdInp=document.getElementById('cmdInput');
  if(cmdInp)cmdInp.addEventListener('input',function(){_cmdIdx=-1;renderCmdResults(this.value);});

  // ── FAB ──
  function toggleFab(){
    document.getElementById('fabMenu').classList.toggle('open');
    var svg=document.querySelector('#fabBtn svg');
    if(svg)svg.style.transform=document.getElementById('fabMenu').classList.contains('open')?'rotate(45deg)':'';
  }
  document.addEventListener('click',function(e){
    if(!e.target.closest('.fab-container')){
      var m=document.getElementById('fabMenu');
      if(m&&m.classList.contains('open')){m.classList.remove('open');var svg=document.querySelector('#fabBtn svg');if(svg)svg.style.transform='';}
    }
  });

  // ── Notif badge ──
  fetch('/admin/api/notif-count').then(function(r){return r.json()}).then(function(d){
    if(d.count>0){
      document.querySelectorAll('a[href="/admin/notifications"] .flex-1').forEach(function(el){
        var badge=el.parentElement.querySelector('.notif-badge');
        if(!badge){badge=document.createElement('span');badge.className='notif-badge bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center';el.parentElement.appendChild(badge);}
        badge.textContent=d.count;
      });
    }
  }).catch(function(){});
  </script>
</body>
</html>`;
}

// ─── Login ───────────────────────────────────────────────────────────────────

const passport = require('passport');

function loginPage(errorMsg = '') {
  const googleConfigured = !!process.env.GOOGLE_CLIENT_ID;
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
  <title>DT Systems · Login</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif;background:#060612;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;-webkit-font-smoothing:antialiased}
    .blob1{position:fixed;top:-20%;left:-10%;width:60vw;height:60vw;background:radial-gradient(circle,rgba(99,102,241,0.18) 0%,transparent 65%);pointer-events:none;border-radius:50%}
    .blob2{position:fixed;bottom:-15%;right:-5%;width:50vw;height:50vw;background:radial-gradient(circle,rgba(139,92,246,0.14) 0%,transparent 65%);pointer-events:none;border-radius:50%}
    .blob3{position:fixed;top:40%;left:55%;width:30vw;height:30vw;background:radial-gradient(circle,rgba(59,130,246,0.08) 0%,transparent 65%);pointer-events:none;border-radius:50%}
    .grid-bg{position:fixed;inset:0;background-image:linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px);background-size:48px 48px;pointer-events:none}
    .card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:36px;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)}
    .gradient-text{background:linear-gradient(135deg,#c7d2fe 0%,#a5b4fc 30%,#818cf8 60%,#6366f1 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    .btn-google{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:12px;color:rgba(255,255,255,0.85);font-size:14px;font-weight:500;cursor:pointer;transition:all 0.2s;text-decoration:none}
    .btn-google:hover{background:rgba(255,255,255,0.11);border-color:rgba(255,255,255,0.2)}
    .divider{display:flex;align-items:center;gap:12px;margin:18px 0}
    .divider-line{flex:1;height:1px;background:rgba(255,255,255,0.06)}
    .divider span{font-size:11px;color:rgba(255,255,255,0.25);white-space:nowrap}
    .input{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:13px 16px;color:rgba(255,255,255,0.9);font-size:14px;outline:none;transition:border-color 0.2s;font-family:inherit}
    .input::placeholder{color:rgba(255,255,255,0.25)}
    .input:focus{border-color:rgba(99,102,241,0.6);background:rgba(99,102,241,0.06)}
    .btn-submit{width:100%;background:linear-gradient(135deg,#6366f1,#7c3aed);border:none;border-radius:12px;padding:13px;color:white;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;margin-top:10px;font-family:inherit;position:relative;overflow:hidden}
    .btn-submit::after{content:'';position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:linear-gradient(to bottom right,transparent 45%,rgba(255,255,255,0.08) 50%,transparent 55%);transform:rotate(-45deg);transition:all 0.5s}
    .btn-submit:hover{background:linear-gradient(135deg,#4f46e5,#6d28d9);transform:translateY(-1px);box-shadow:0 8px 24px rgba(99,102,241,0.4)}
    .btn-submit:hover::after{left:100%}
    .error-box{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:12px;padding:12px 16px;color:#fca5a5;font-size:13px;margin-bottom:18px}
    .logo-ring{width:80px;height:80px;border-radius:20px;border:2px solid rgba(99,102,241,0.3);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;box-shadow:0 0 30px rgba(99,102,241,0.15)}
    .logo-icon{width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#6366f1,#7c3aed);display:flex;align-items:center;justify-content:center;box-shadow:0 0 40px rgba(99,102,241,0.5),0 0 80px rgba(99,102,241,0.2);animation:pulse-glow 3s ease-in-out infinite}
    .card{animation:fade-up 0.6s ease-out}
    .particles{position:fixed;inset:0;pointer-events:none;overflow:hidden}
    .particles::before,.particles::after{content:'';position:absolute;width:6px;height:6px;border-radius:50%;background:rgba(99,102,241,0.4);box-shadow:0 0 12px rgba(99,102,241,0.6);animation:float-dot 8s ease-in-out infinite}
    .particles::before{top:20%;left:15%;animation-delay:0s}
    .particles::after{top:60%;right:20%;width:4px;height:4px;background:rgba(139,92,246,0.35);box-shadow:0 0 10px rgba(139,92,246,0.5);animation-delay:-4s}
    @keyframes pulse-glow{0%,100%{box-shadow:0 0 40px rgba(99,102,241,0.4),0 0 80px rgba(99,102,241,0.15)}50%{box-shadow:0 0 60px rgba(99,102,241,0.6),0 0 120px rgba(99,102,241,0.25)}}
    @keyframes fade-up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes float-dot{0%,100%{transform:translateY(0) translateX(0)}25%{transform:translateY(-20px) translateX(10px)}50%{transform:translateY(-5px) translateX(-8px)}75%{transform:translateY(-25px) translateX(5px)}}
  </style>
</head>
<body>
  <div class="blob1"></div>
  <div class="blob2"></div>
  <div class="blob3"></div>
  <div class="grid-bg"></div>
  <div class="particles"></div>

  <div style="width:100%;max-width:400px;padding:0 20px;position:relative;z-index:10">
    <!-- Brand -->
    <div style="text-align:center;margin-bottom:28px">
      <div class="logo-ring">
        <div class="logo-icon">
          <span style="color:white;font-size:22px;font-weight:900;letter-spacing:-0.5px">DT</span>
        </div>
      </div>
      <div style="font-size:36px;font-weight:800;letter-spacing:-0.8px" class="gradient-text">DT Systems</div>
      <div style="color:rgba(255,255,255,0.35);font-size:13px;margin-top:4px">David Sebastian Taranto · CRM & Proyectos</div>
    </div>

    <!-- Card -->
    <div class="card">
      ${errorMsg ? `<div class="error-box">⚠ ${errorMsg}</div>` : ''}

      ${googleConfigured ? `
      <a href="/admin/auth/google" class="btn-google">
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>
        Continuar con Google
      </a>
      <div class="divider"><div class="divider-line"></div><span>o con contraseña</span><div class="divider-line"></div></div>` : ''}

      <form method="POST" action="/admin/login">
        <input type="password" name="password" autofocus placeholder="Contraseña de acceso" class="input">
        <button type="submit" class="btn-submit">Acceder al panel →</button>
      </form>
    </div>

    <div style="text-align:center;margin-top:20px;color:rgba(255,255,255,0.2);font-size:11px">
      v${APP_VERSION} · Solo uso interno
    </div>
  </div>
</body>
</html>`;
}

router.get('/login', (req, res) => {
  const errors = { 1: 'Contraseña incorrecta', 2: 'Email no autorizado para acceder al panel' };
  res.send(loginPage(errors[req.query.error] || ''));
});

router.post('/login', (req, res) => {
  if (req.body.password && req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.authed = true;
    req.session.user = { name: 'David Taranto', email: 'admin' };
    return res.redirect('/admin');
  }
  res.redirect('/admin/login?error=1');
});

// Google OAuth routes
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/admin/login?error=2' }),
  (req, res) => {
    req.session.authed = true;
    req.session.user = req.user;
    res.redirect('/admin');
  }
);

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/admin/login');
  });
});

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  const clients = await db.listAllClients();
  const projects = await db.listProjects();

  const pendingReview = clients.filter(c => c.demo_status === 'pending_review');
  const ganados = clients.filter(c => c.client_stage === 'won').length;
  const activeProjects = projects.filter(p => ['planning','in_progress','waiting_client','waiting_payment','review'].includes(p.status)).length;
  const pendingTasks = projects.reduce((n, p) => n + (p.tasks || []).filter(t => !t.done).length, 0);

  const metricCards = [
    { label: 'Pipeline WA',     value: clients.length,        icon: '💬', grad: 'from-blue-500 to-blue-600',      sub: `${clients.filter(c => c.client_stage !== 'lost' && c.client_stage !== 'dormant').length} activos`, href: '/admin/clients' },
    { label: 'Demos pendientes', value: pendingReview.length,  icon: '⏳', grad: pendingReview.length > 0 ? 'from-orange-400 to-orange-500' : 'from-slate-400 to-slate-500', sub: 'para revisar', alert: pendingReview.length > 0, href: '/admin/clients' },
    { label: 'Proyectos activos',value: activeProjects,        icon: '📁', grad: 'from-purple-500 to-purple-600',  sub: `${projects.length} en total`, href: '/admin/projects' },
    { label: 'Tareas pendientes',value: pendingTasks,          icon: '✅', grad: pendingTasks > 0 ? 'from-amber-400 to-amber-500' : 'from-emerald-500 to-emerald-600', sub: 'en proyectos', href: '/admin/tasks' },
  ].map(m => `
    <a href="${m.href || '#'}" class="bg-gradient-to-br ${m.grad} rounded-2xl p-5 text-white relative overflow-hidden block hover:opacity-95 hover:scale-[1.01] transition-all cursor-pointer no-underline">
      <div class="flex items-start justify-between">
        <div>
          <div class="text-xs font-medium opacity-75 uppercase tracking-wide">${m.label}</div>
          <div class="text-3xl md:text-4xl font-bold mt-1">${m.value}</div>
          <div class="text-xs opacity-60 mt-1">${m.sub}</div>
        </div>
        <div class="text-3xl opacity-50">${m.icon}</div>
      </div>
      ${m.alert ? '<div class="absolute top-3 right-3 w-2 h-2 bg-white rounded-full animate-pulse opacity-80"></div>' : ''}
    </a>`).join('');

  // Alert strip
  const alertStrip = pendingReview.length ? `
    <div class="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
      <span class="text-lg flex-shrink-0">⚠️</span>
      <div class="flex-1 min-w-0">
        <span class="font-semibold text-orange-800 text-sm">Demos esperando revisión — </span>
        <span class="text-xs text-orange-600 truncate">
          ${pendingReview.map(c => `<a href="/admin/review/${encodeURIComponent(c.phone)}" class="underline font-medium">${escapeHtml(c.report?.cliente?.nombre || c.phone)}</a>`).join(' · ')}
        </span>
      </div>
      <a href="/admin/review/${encodeURIComponent(pendingReview[0].phone)}" class="flex-shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
        Revisar →
      </a>
    </div>` : '';

  // Pipeline funnel
  const pipelineHtml = STAGES.slice(0, 6).map(s => {
    const count = clients.filter(c => c.client_stage === s.key).length;
    const pct = clients.length > 0 ? Math.round(count / clients.length * 100) : 0;
    return `<a href="/admin/clients?stage=${s.key}" class="flex items-center gap-3 py-1 rounded-lg hover:bg-slate-50 -mx-2 px-2 transition-colors cursor-pointer group">
      <div class="text-xs text-slate-500 w-28 truncate group-hover:text-slate-700 transition-colors">${s.label}</div>
      <div class="flex-1 bg-slate-100 rounded-full h-1.5">
        <div class="h-1.5 rounded-full transition-all" style="width:${Math.max(pct, count > 0 ? 8 : 0)}%;background:${s.dot}"></div>
      </div>
      <div class="text-xs font-semibold text-slate-700 w-5 text-right">${count}</div>
    </a>`;
  }).join('');

  // Recent activity: last 5 leads + last 5 projects combined
  const recentLeads = clients.slice(0, 4).map(c => {
    const nombre = c.report?.cliente?.nombre || c.context?.nombre || '—';
    const phoneUrl = encodeURIComponent(c.phone);
    return `<div class="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors" onclick="location.href='/admin/client/${phoneUrl}'">
      <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
        ${escapeHtml((nombre[0] || '?').toUpperCase())}
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-slate-800 truncate">${escapeHtml(nombre)}</div>
        <div class="text-xs text-slate-400 truncate">${escapeHtml(c.report?.proyecto?.tipo || c.phone)}</div>
      </div>
      <div class="flex-shrink-0">${demoStatusBadge(c.demo_status)}</div>
    </div>`;
  }).join('');

  const recentProjects = projects.slice(0, 4).map(p => {
    const pending = (p.tasks || []).filter(t => !t.done).length;
    return `<div class="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors" onclick="location.href='/admin/projects/${p.id}'">
      <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm flex-shrink-0">
        ${escapeHtml((p.client_name[0] || '?').toUpperCase())}
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-slate-800 truncate">${escapeHtml(p.title || p.client_name)}</div>
        <div class="text-xs text-slate-400 truncate">${escapeHtml(p.client_name)}</div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        ${pending > 0 ? `<span class="text-xs text-amber-600 font-medium">${pending} tarea${pending > 1 ? 's' : ''}</span>` : ''}
        ${projectStatusBadge(p.status)}
      </div>
    </div>`;
  }).join('');

  // Activity feed: flatten timelines of all clients, most recent first
  const allEvents = clients.flatMap(c => {
    const nombre = c.report?.cliente?.nombre || c.context?.nombre || c.phone;
    return (c.timeline || []).map(e => ({ ...e, clientName: nombre, phone: c.phone }));
  }).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  const eventIcon = ev => {
    const m = { report_generated: '📋', demos_ready: '🎨', demo_sent_to_client: '✈️', demo_approved: '✅', demo_rejected: '✗', changes_requested: '✏️', stage_changed: '🔄', followup_sent: '📤', abandoned: '💤' };
    return m[ev] || '•';
  };

  const activityFeed = allEvents.map(e => `
    <div class="flex items-start gap-2.5 py-2.5 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors" onclick="location.href='/admin/client/${encodeURIComponent(e.phone)}'">
      <span class="text-base flex-shrink-0 mt-0.5">${eventIcon(e.event)}</span>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-medium text-slate-700 truncate">${escapeHtml(e.clientName)}</div>
        <div class="text-xs text-slate-400 truncate">${escapeHtml(e.note || e.event)}</div>
      </div>
      <div class="text-[10px] text-slate-300 flex-shrink-0">${timeAgo(e.date)}</div>
    </div>`).join('');

  // Pending tasks across all projects (for dashboard widget)
  const allPendingTasks = projects.flatMap(p =>
    (p.tasks || [])
      .filter(t => !t.done)
      .map(t => ({ ...t, projectId: p.id, projectTitle: p.title || p.client_name, isPersonal: p.is_personal }))
  ).sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
  }).slice(0, 8);

  // Deadlines widget
  const now = new Date();
  const projectsWithDeadline = projects
    .filter(p => p.deadline)
    .map(p => ({ ...p, deadlineDate: new Date(p.deadline) }))
    .sort((a, b) => a.deadlineDate - b.deadlineDate)
    .slice(0, 6);

  // Financial overview
  const financialData = (() => {
    const withBudget = projects.filter(p => p.budget && parseFloat(String(p.budget).replace(/[^0-9.]/g, '')) > 0);
    const parseBudget = b => parseFloat(String(b || '0').replace(/[^0-9.]/g, '')) || 0;
    const totalRevenue = withBudget.reduce((s, p) => s + parseBudget(p.budget), 0);
    const paid = withBudget.filter(p => p.budget_status === 'paid').reduce((s, p) => s + parseBudget(p.budget), 0);
    const approved = withBudget.filter(p => ['approved','partial','paid'].includes(p.budget_status)).reduce((s, p) => s + parseBudget(p.budget), 0);
    const pending = withBudget.filter(p => ['not_quoted','quoted'].includes(p.budget_status)).reduce((s, p) => s + parseBudget(p.budget), 0);
    const fmtMoney = n => n >= 1000 ? (n/1000).toFixed(n%1000===0?0:1) + 'K' : n.toFixed(0);
    const byStatus = BUDGET_STATUS.map(bs => ({
      ...bs,
      count: withBudget.filter(p => p.budget_status === bs.key).length,
      total: withBudget.filter(p => p.budget_status === bs.key).reduce((s, p) => s + parseBudget(p.budget), 0),
    })).filter(bs => bs.count > 0);
    return { totalRevenue, paid, approved, pending, withBudget, fmtMoney, byStatus };
  })();

  const body = `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
      <div>
        <h1 class="text-xl md:text-2xl font-bold text-slate-900">${(() => {
          const h = new Date().getHours();
          const name = (req.session?.user?.name || 'David').split(' ')[0];
          const greet = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
          return `${greet}, ${name} 👋`;
        })()}</h1>
        <div class="text-sm text-slate-400 mt-0.5">${new Date().toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
      </div>
    </div>
    ${alertStrip}
    <div class="grid grid-cols-2 gap-3 md:gap-4 mb-6 lg:grid-cols-4">${metricCards}</div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
      <!-- Pipeline WA -->
      <div class="bg-white rounded-2xl border border-slate-200 p-5 overflow-hidden">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-slate-700">Pipeline WA</h2>
          <a href="/admin/clients" class="text-xs text-blue-600 hover:underline">Ver todos →</a>
        </div>
        <div class="space-y-1.5">${pipelineHtml || '<p class="text-sm text-slate-400">Sin leads</p>'}</div>
      </div>

      <!-- Tareas pendientes (→ /admin/tasks) -->
      <div class="bg-white rounded-2xl border border-slate-200 p-5 overflow-hidden">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-slate-700">Tareas pendientes</h2>
          <a href="/admin/tasks" class="text-xs text-blue-600 hover:underline">Ver todas →</a>
        </div>
        ${allPendingTasks.length > 0 ? `
          <div class="space-y-1">
            ${allPendingTasks.slice(0, 5).map(t => {
              const dl = t.due_date ? Math.ceil((new Date(t.due_date) - new Date()) / 86400000) : null;
              const dlColor = dl === null ? '' : dl < 0 ? 'text-red-500' : dl <= 1 ? 'text-orange-500' : 'text-slate-400';
              const dlLabel = dl === null ? '' : dl < 0 ? 'Vencida' : dl === 0 ? 'Hoy' : `${dl}d`;
              return `
              <a href="/admin/projects/${t.projectId}" class="flex items-center gap-2 group py-2 px-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors">
                <div class="w-2 h-2 rounded-full flex-shrink-0 ${t.priority === 'high' ? 'bg-red-400' : t.priority === 'medium' ? 'bg-amber-400' : 'bg-slate-300'}"></div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-slate-700 group-hover:text-blue-600 truncate leading-tight">${escapeHtml(t.text)}</div>
                  <div class="text-[10px] text-slate-400 truncate leading-tight">${escapeHtml(t.projectTitle)}</div>
                </div>
                ${dl !== null ? `<span class="text-[10px] font-semibold flex-shrink-0 ${dlColor}">${dlLabel}</span>` : ''}
              </a>`;
            }).join('')}
            ${allPendingTasks.length > 5 ? `<a href="/admin/tasks" class="text-xs text-slate-400 hover:text-blue-600 pt-1 block text-center">+${allPendingTasks.length - 5} más →</a>` : ''}
          </div>` : `<div class="text-center py-6"><div class="text-2xl mb-1">✅</div><p class="text-xs text-slate-400">Sin tareas pendientes</p></div>`}
      </div>

      <!-- Próximas deadlines -->
      <div class="bg-white rounded-2xl border border-slate-200 p-5 overflow-hidden">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-slate-700">Próximas deadlines</h2>
          <a href="/admin/projects" class="text-xs text-blue-600 hover:underline">Proyectos →</a>
        </div>
        ${projectsWithDeadline.length > 0 ? `
          <div class="space-y-2">
            ${projectsWithDeadline.map(p => {
              const daysLeft = Math.ceil((p.deadlineDate - now) / (1000 * 60 * 60 * 24));
              const isPast = daysLeft < 0;
              const isUrgent = daysLeft >= 0 && daysLeft <= 3;
              const isSoon = daysLeft > 3 && daysLeft <= 7;
              const dotColor = isPast ? 'bg-red-500' : isUrgent ? 'bg-orange-400' : isSoon ? 'bg-amber-400' : 'bg-emerald-400';
              const textColor = isPast ? 'text-red-600' : isUrgent ? 'text-orange-600' : isSoon ? 'text-amber-600' : 'text-slate-500';
              const label = isPast ? `Vencida (hace ${Math.abs(daysLeft)}d)` : daysLeft === 0 ? '¡Hoy!' : `en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`;
              return `<a href="/admin/projects/${p.id}" class="flex items-start gap-2.5 group py-1.5 -mx-1 px-1 rounded-lg hover:bg-slate-50 transition-colors block">
                <div class="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dotColor}"></div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-slate-700 group-hover:text-blue-600 truncate">${escapeHtml(p.title || p.client_name)}</div>
                  <div class="text-[10px] ${textColor} font-medium">${label} · ${p.deadlineDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</div>
                </div>
              </a>`;
            }).join('')}
          </div>` : `<div class="text-center py-6"><div class="text-2xl mb-1">📅</div><p class="text-xs text-slate-400">Sin deadlines configuradas</p><a href="/admin/projects" class="text-xs text-blue-600 hover:underline mt-1 block">Agregar →</a></div>`}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
      <!-- Últimos leads -->
      <div class="bg-white rounded-2xl border border-slate-200 p-5 overflow-hidden">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-700">Últimos leads WA</h2>
          <a href="/admin/clients" class="text-xs text-blue-600 hover:underline">Ver todos →</a>
        </div>
        ${recentLeads || '<p class="text-sm text-slate-400">Sin leads</p>'}
      </div>
      <!-- Últimos proyectos -->
      <div class="bg-white rounded-2xl border border-slate-200 p-5 overflow-hidden">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-700">Últimos proyectos</h2>
          <a href="/admin/projects" class="text-xs text-blue-600 hover:underline">Ver todos →</a>
        </div>
        ${recentProjects || '<p class="text-sm text-slate-400">Sin proyectos</p>'}
      </div>
    </div>

    <!-- Resumen financiero -->
    ${financialData.withBudget.length > 0 ? `
    <div class="bg-white rounded-2xl border border-slate-200 p-5 overflow-hidden mb-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-slate-700">💰 Resumen financiero</h2>
        <a href="/admin/projects?view=kanban" class="text-xs text-blue-600 hover:underline">Ver proyectos →</a>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-slate-800">$${financialData.fmtMoney(financialData.totalRevenue)}</div>
          <div class="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Pipeline total</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-emerald-600">$${financialData.fmtMoney(financialData.paid)}</div>
          <div class="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Cobrado</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600">$${financialData.fmtMoney(financialData.approved)}</div>
          <div class="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Aprobado</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-amber-500">$${financialData.fmtMoney(financialData.pending)}</div>
          <div class="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Pendiente</div>
        </div>
      </div>
      <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
        ${financialData.totalRevenue > 0 ? `
          <div class="h-full bg-emerald-500 rounded-l-full" style="width:${Math.round(financialData.paid/financialData.totalRevenue*100)}%" title="Cobrado"></div>
          <div class="h-full bg-blue-500" style="width:${Math.round((financialData.approved-financialData.paid)/financialData.totalRevenue*100)}%" title="Aprobado"></div>
          <div class="h-full bg-amber-400 rounded-r-full" style="width:${Math.round(financialData.pending/financialData.totalRevenue*100)}%" title="Pendiente"></div>
        ` : ''}
      </div>
      <div class="flex items-center gap-4 mt-3">
        ${financialData.byStatus.map(bs => `
          <div class="flex items-center gap-1.5">
            <span class="px-1.5 py-0.5 rounded text-[10px] font-medium ${bs.badge}">${bs.label}</span>
            <span class="text-[10px] text-slate-400">${bs.count} · $${financialData.fmtMoney(bs.total)}</span>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <!-- Actividad reciente (collapsible/compact) -->
    ${activityFeed ? `
    <div class="bg-white rounded-2xl border border-slate-200 p-5 overflow-hidden">
      <h2 class="text-sm font-semibold text-slate-700 mb-3">Actividad reciente</h2>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-6">${activityFeed}</div>
    </div>` : ''}`;

  res.send(layout('Dashboard', body, { pendingCount: pendingReview.length, activePage: 'dashboard', user: req.session?.user }));
});

// ─── WA Clients list ─────────────────────────────────────────────────────────

router.get('/clients', requireAuth, async (req, res) => {
  const filter = req.query.stage || 'all';
  const search = (req.query.q || '').toLowerCase();
  const view = req.query.view || 'list'; // 'list' or 'kanban'
  const showArchived = req.query.archived === '1';
  const sortBy = req.query.sort || 'recent'; // recent | oldest | name | stage
  let clients = await db.listAllClients(showArchived);
  if (showArchived) clients = clients.filter(c => c.archived);
  const allClients = clients;
  const pendingReview = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review');

  if (search) clients = clients.filter(c => {
    const n = (c.report?.cliente?.nombre || c.context?.nombre || '').toLowerCase();
    return n.includes(search) || c.phone.includes(search) || (c.report?.proyecto?.tipo || '').toLowerCase().includes(search);
  });
  if (filter !== 'all') clients = clients.filter(c => c.client_stage === filter);

  // Ordenamiento
  if (sortBy === 'oldest') clients.reverse();
  if (sortBy === 'name') clients.sort((a, b) => {
    const na = (a.report?.cliente?.nombre || a.context?.nombre || 'zzz').toLowerCase();
    const nb = (b.report?.cliente?.nombre || b.context?.nombre || 'zzz').toLowerCase();
    return na.localeCompare(nb);
  });
  if (sortBy === 'stage') clients.sort((a, b) => {
    const order = { lead: 0, qualified: 1, demo_sent: 2, negotiating: 3, won: 4, lost: 5, dormant: 6 };
    return (order[a.client_stage] ?? 99) - (order[b.client_stage] ?? 99);
  });

  const tabs = [{ key: 'all', label: 'Todos', count: allClients.length, dot: null },
    ...STAGES.map(s => ({ key: s.key, label: s.label, count: allClients.filter(c => c.client_stage === s.key).length, dot: s.dot }))
  ].filter(t => t.key === 'all' || t.count > 0);

  const tabHtml = tabs.map(t => `
    <a href="/admin/clients?stage=${t.key}&view=${view}${search ? '&q=' + encodeURIComponent(search) : ''}"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === t.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}">
      ${t.dot ? `<span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${t.dot}"></span>` : ''}
      ${t.label} <span class="text-xs ${filter === t.key ? 'opacity-60' : 'text-slate-400'} ml-0.5">${t.count}</span>
    </a>`).join('');

  // Stats para header
  const statsTotal = allClients.length;
  const statsActivos = allClients.filter(c => !['lost','dormant','won'].includes(c.client_stage)).length;
  const statsDemos = allClients.filter(c => ['sent','approved'].includes(c.demo_status)).length;
  const statsGanados = allClients.filter(c => c.client_stage === 'won').length;

  // Mobile cards + desktop table rows
  const mobileCards = clients.map(c => {
    const nombre = c.report?.cliente?.nombre || c.context?.nombre || '—';
    const tipo = c.report?.proyecto?.tipo || '';
    const phoneUrl = encodeURIComponent(c.phone);
    const steps = processSteps(c);
    const done = steps.filter(s => s.done).length;
    const pct = Math.round(done / steps.length * 100);
    return `
      <a href="/admin/client/${phoneUrl}" class="block bg-white rounded-2xl border border-slate-200 p-4 hover:border-blue-200 hover:shadow-sm transition-all active:scale-[0.99]">
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-slate-800 truncate">${escapeHtml(nombre)}</div>
            <div class="text-xs text-slate-400 truncate mt-0.5">${escapeHtml(tipo || c.phone)}</div>
          </div>
          ${c.demo_status === 'pending_review'
            ? `<span class="flex-shrink-0 bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-1 rounded-lg">Revisar</span>`
            : stageBadge(c.client_stage)}
        </div>
        <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <div class="bg-slate-100 rounded-full h-1.5 flex-1 max-w-[80px]">
              <div class="h-1.5 rounded-full bg-blue-500" style="width:${pct}%"></div>
            </div>
            <span class="text-xs text-slate-400">${done}/${steps.length}</span>
          </div>
          <div class="flex items-center gap-2">
            ${demoStatusBadge(c.demo_status)}
            <span class="text-xs text-slate-300">${timeAgo(c.updated_at)}</span>
          </div>
        </div>
        ${showArchived ? `<div class="mt-3 pt-3 border-t border-slate-100">
          <form method="POST" action="/admin/unarchive/${phoneUrl}" onclick="event.preventDefault(); event.stopPropagation(); this.submit();">
            <button class="w-full bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">Desarchivar</button>
          </form>
        </div>` : ''}
      </a>`;
  }).join('');

  const rows = clients.map(c => {
    const nombre = c.report?.cliente?.nombre || c.context?.nombre || null;
    const tipo = c.report?.proyecto?.tipo || null;
    const phoneUrl = encodeURIComponent(c.phone);
    const steps = processSteps(c);
    const done = steps.filter(s => s.done).length;
    const pct = Math.round(done / steps.length * 100);
    const lastMsg = (c.history || []).filter(m => m.role === 'user').pop();
    const preview = lastMsg ? escapeHtml(lastMsg.content.slice(0, 55)) + (lastMsg.content.length > 55 ? '…' : '') : '';
    const stage = STAGES.find(s => s.key === (c.client_stage || 'lead')) || STAGES[0];
    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group" onclick="location.href='/admin/client/${phoneUrl}'">
        <td class="px-4 py-3.5">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white" style="background:${stage.dot}">
              ${nombre ? escapeHtml(nombre[0].toUpperCase()) : '?'}
            </div>
            <div class="min-w-0">
              <div class="font-semibold text-slate-800 ${nombre ? '' : 'text-slate-400 italic'}">${escapeHtml(nombre || 'Sin identificar')}</div>
              <div class="text-xs text-slate-400 truncate mt-0.5 max-w-[180px]">${preview || escapeHtml(c.phone)}</div>
            </div>
          </div>
        </td>
        <td class="px-4 py-3.5 text-sm text-slate-500 max-w-[160px]">
          <div class="truncate">${tipo ? escapeHtml(tipo) : '<span class="text-slate-300 italic">Sin proyecto</span>'}</div>
        </td>
        <td class="px-4 py-3.5">${stageBadge(c.client_stage)}</td>
        <td class="px-4 py-3.5">${demoStatusBadge(c.demo_status)}</td>
        <td class="px-4 py-3.5">
          <div class="flex items-center gap-2">
            <div class="bg-slate-100 rounded-full h-1.5" style="width:64px">
              <div class="h-1.5 rounded-full bg-blue-500 transition-all" style="width:${pct}%"></div>
            </div>
            <span class="text-xs text-slate-400 tabular-nums">${done}/${steps.length}</span>
          </div>
        </td>
        <td class="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">${timeAgo(c.updated_at)}</td>
        <td class="px-4 py-3.5 text-right">
          ${showArchived
            ? `<form method="POST" action="/admin/unarchive/${phoneUrl}" class="inline" onclick="event.stopPropagation()">
                <button class="bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">Desarchivar</button>
              </form>`
            : c.demo_status === 'pending_review'
            ? `<a href="/admin/review/${phoneUrl}" class="bg-orange-500 text-white hover:bg-orange-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors" onclick="event.stopPropagation()">Revisar →</a>`
            : `<span class="opacity-0 group-hover:opacity-100 text-blue-600 text-xs transition-opacity font-medium">Abrir →</span>`}
        </td>
      </tr>`;
  }).join('');

  // Kanban view: group clients by stage — with drag-and-drop
  const kanbanHtml = (() => {
    const kanbanStages = STAGES.slice(0, 7); // exclude 'dormant' for space
    return `
      <div class="overflow-x-auto pb-4">
      <div class="flex gap-4" style="min-height:60vh;min-width:max-content">
        ${kanbanStages.map(s => {
          const stageClients = clients.filter(c => c.client_stage === s.key);
          return `
            <div class="flex-shrink-0" style="width:260px">
              <div class="flex items-center gap-2 mb-3 px-1">
                <div class="w-2.5 h-2.5 rounded-full" style="background:${s.dot}"></div>
                <span class="text-xs font-bold text-slate-600 uppercase tracking-wide">${s.label}</span>
                <span class="ml-auto text-xs font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">${stageClients.length}</span>
              </div>
              <div class="pipeline-kanban-col kanban-col bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 p-2" data-stage="${s.key}" style="min-height:200px">
                ${stageClients.length > 0 ? stageClients.map(c => {
                  const nombre = c.report?.cliente?.nombre || c.context?.nombre || '—';
                  const tipo = c.report?.proyecto?.tipo || '';
                  return `
                    <div class="kanban-card bg-white rounded-xl border border-slate-200 p-3 mb-2 cursor-grab active:cursor-grabbing"
                         data-phone="${escapeHtml(c.phone)}"
                         onclick="if(!window._pipelineDragging)location.href='/admin/client/${encodeURIComponent(c.phone)}'">
                      <div class="text-sm font-medium text-slate-800 truncate">${escapeHtml(nombre)}</div>
                      ${tipo ? `<div class="text-xs text-slate-400 mt-0.5 truncate">${escapeHtml(tipo)}</div>` : ''}
                      <div class="flex items-center justify-between mt-2">
                        ${demoStatusBadge(c.demo_status)}
                        <span class="text-[10px] text-slate-300">${timeAgo(c.updated_at)}</span>
                      </div>
                    </div>`;
                }).join('')
                : '<div class="kanban-empty">Arrastra contactos aqu&iacute;</div>'}
              </div>
            </div>`;
        }).join('')}
      </div>
      </div>
      <script>
      window._pipelineDragging = false;
      document.querySelectorAll('.pipeline-kanban-col').forEach(function(col) {
        new Sortable(col, {
          group: 'pipeline',
          animation: 200,
          ghostClass: 'kanban-ghost',
          dragClass: 'kanban-drag',
          onStart: function() { window._pipelineDragging = true; },
          onEnd: function(evt) {
            setTimeout(function() { window._pipelineDragging = false; }, 100);
            var card = evt.item;
            var newStage = evt.to.dataset.stage;
            fetch('/admin/api/client-stage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: card.dataset.phone, newStage: newStage })
            }).then(function(r) { return r.json(); }).then(function(d) {
              if (d.ok) {
                showToast('Contacto movido');
                document.querySelectorAll('.pipeline-kanban-col').forEach(function(c) {
                  var empty = c.querySelector('.kanban-empty');
                  if (c.querySelectorAll('.kanban-card').length === 0 && !empty) {
                    c.innerHTML = '<div class="kanban-empty">Arrastra contactos aqu\\u00ed</div>';
                  } else if (empty && c.querySelectorAll('.kanban-card').length > 0) {
                    empty.remove();
                  }
                });
              } else {
                showToast('Error: ' + (d.error || ''), 'error');
                setTimeout(function() { location.reload(); }, 1500);
              }
            }).catch(function() {
              showToast('Error de red', 'error');
              setTimeout(function() { location.reload(); }, 1500);
            });
          }
        });
      });
      </script>`;
  })();

  const body = `
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
      <div>
        <h1 class="text-xl md:text-2xl font-bold text-slate-900">Pipeline</h1>
        <p class="text-sm text-slate-400 mt-0.5">Consultas recibidas por WhatsApp</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button onclick="location.reload()" title="Actualizar" class="flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          Actualizar
        </button>
        <div class="flex items-center gap-0.5 border border-slate-200 rounded-lg p-0.5 bg-white">
          <a href="/admin/clients?stage=${escapeHtml(filter)}&view=list${search ? '&q='+encodeURIComponent(search) : ''}"
            class="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            Lista
          </a>
          <a href="/admin/clients?stage=${escapeHtml(filter)}&view=kanban${search ? '&q='+encodeURIComponent(search) : ''}"
            class="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Kanban
          </a>
        </div>
        <select onchange="location.href='/admin/clients?stage=${escapeHtml(filter)}&view=${view}&sort='+this.value${search ? `+'&q=${encodeURIComponent(search)}'` : ''}" class="border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 bg-white">
          <option value="recent" ${sortBy==='recent'?'selected':''}>Más recientes</option>
          <option value="oldest" ${sortBy==='oldest'?'selected':''}>Más antiguos</option>
          <option value="name" ${sortBy==='name'?'selected':''}>Nombre A-Z</option>
          <option value="stage" ${sortBy==='stage'?'selected':''}>Por etapa</option>
        </select>
        <a href="/admin/clients?archived=${showArchived?'0':'1'}" class="flex items-center gap-1 text-xs border ${showArchived ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-400 hover:text-slate-600'} px-3 py-1.5 rounded-lg transition-colors">
          📦 ${showArchived ? 'Archivados' : 'Ver archivados'}
        </a>
        <div class="relative group">
          <button class="flex items-center gap-1 text-xs border border-dashed border-slate-300 text-slate-400 hover:border-blue-300 hover:text-blue-500 px-3 py-1.5 rounded-lg transition-colors">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Lead de prueba
          </button>
          <div class="hidden group-hover:block absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 w-52 py-1.5">
            <div class="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo de demo</div>
            <form method="POST" action="/admin/create-demo-lead"><input type="hidden" name="tipo" value="web">
              <button class="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-slate-600 flex items-center gap-2">🌐 <span>Web — Panadería</span></button></form>
            <form method="POST" action="/admin/create-demo-lead"><input type="hidden" name="tipo" value="bot">
              <button class="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-slate-600 flex items-center gap-2">💬 <span>Bot WA — Veterinaria</span></button></form>
            <form method="POST" action="/admin/create-demo-lead"><input type="hidden" name="tipo" value="app">
              <button class="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-slate-600 flex items-center gap-2">📱 <span>App móvil — Gimnasio</span></button></form>
          </div>
        </div>
      </div>
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <div class="bg-white rounded-2xl border border-slate-200 px-4 py-3.5">
        <div class="text-xs text-slate-400 font-medium mb-1">Total contactos</div>
        <div class="text-2xl font-bold text-slate-800">${statsTotal}</div>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 px-4 py-3.5">
        <div class="text-xs text-slate-400 font-medium mb-1">En proceso</div>
        <div class="text-2xl font-bold text-blue-600">${statsActivos}</div>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 px-4 py-3.5">
        <div class="text-xs text-slate-400 font-medium mb-1">Demos enviadas</div>
        <div class="text-2xl font-bold text-indigo-600">${statsDemos}</div>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 px-4 py-3.5">
        <div class="text-xs text-slate-400 font-medium mb-1">Proyectos ganados</div>
        <div class="text-2xl font-bold text-emerald-600">${statsGanados}</div>
      </div>
    </div>

    <!-- Search + tabs -->
    <div class="flex flex-col sm:flex-row gap-3 mb-4">
      <form method="GET" action="/admin/clients" class="flex-1">
        <input type="hidden" name="stage" value="${escapeHtml(filter)}">
        <input type="hidden" name="view" value="${escapeHtml(view)}">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" name="q" value="${escapeHtml(search)}" placeholder="Buscar por nombre, teléfono o proyecto..."
            class="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
        </div>
      </form>
    </div>
    <div class="flex items-center gap-1.5 mb-4 flex-wrap">${tabHtml}
      <span class="ml-auto text-xs text-slate-400 self-center">${clients.length} resultado${clients.length !== 1 ? 's' : ''}</span>
    </div>
    ${view === 'kanban' ? kanbanHtml : `
    <!-- Mobile: cards -->
    <div class="md:hidden space-y-3">
      ${clients.length === 0
        ? `<div class="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">Sin resultados</div>`
        : mobileCards}
    </div>
    <!-- Desktop: table -->
    <div class="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div class="overflow-x-auto">
      <table class="w-full min-w-[600px]">
        <thead class="border-b border-slate-100">
          <tr class="text-xs text-slate-400 uppercase">
            <th class="px-4 py-3 text-left font-medium">Cliente</th>
            <th class="px-4 py-3 text-left font-medium">Proyecto</th>
            <th class="px-4 py-3 text-left font-medium">Etapa</th>
            <th class="px-4 py-3 text-left font-medium">Demo</th>
            <th class="px-4 py-3 text-left font-medium">Avance</th>
            <th class="px-4 py-3 text-left font-medium">Actividad</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td class="px-4 py-12 text-center text-slate-400 text-sm" colspan="7">Sin resultados</td></tr>'}</tbody>
      </table>
      </div>
    </div>`}`;

  res.send(layout('Pipeline', body, { pendingCount: pendingReview.length, activePage: 'clients', user: req.session?.user }));
});

// ─── WA Client detail ────────────────────────────────────────────────────────

router.get('/client/:phone', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  const conv = await db.getConversation(phone);
  if (!conv) return res.status(404).send(layout('No encontrado', '<p class="text-slate-500 p-4">Cliente no encontrado.</p>', { user: req.session?.user }));

  const nombre = conv.report?.cliente?.nombre || conv.context?.nombre || '—';
  const email = conv.report?.cliente?.email || '';
  const proyecto = conv.report?.proyecto || {};
  const requisitos = conv.report?.requisitos || {};
  const resumen = conv.report?.resumen_ejecutivo || '';
  const slug = phoneSlug(phone);
  const phoneUrl = encodeURIComponent(phone);
  const allClients = await db.listAllClients();
  const pendingCount = allClients.filter(c => c.demo_status === 'pending_review').length;
  const allClientRecords = await db.listClientRecords();
  // Try to find a matching client by phone
  const matchedClient = allClientRecords.find(cr =>
    cr.phone && conv.phone && (cr.phone.replace(/\D/g,'').includes(conv.phone.replace(/\D/g,'').slice(-8)) || conv.phone.replace(/\D/g,'').includes(cr.phone.replace(/\D/g,'').slice(-8)))
  );

  const steps = processSteps(conv);
  const doneCount = steps.filter(s => s.done).length;

  // Mobile: vertical checklist compacto / Desktop: stepper horizontal
  const stepIcon = (s) => {
    if (s.done) return '<svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>';
    if (s.warn) return '<svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>';
    return '';
  };
  const stepColor = (s) => {
    if (s.done) return 'bg-blue-600 border-blue-600';
    if (s.warn) return 'bg-amber-400 border-amber-400';
    return 'bg-white border-slate-300';
  };

  const stepperMobile = steps.map(s => `
    <div class="flex items-center gap-2.5 py-1.5">
      <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${stepColor(s)}">
        ${stepIcon(s)}
      </div>
      <div class="flex-1 min-w-0">
        <span class="text-xs ${s.done ? 'text-slate-700 font-medium' : s.warn ? 'text-amber-600 font-medium' : 'text-slate-400'}">${s.label}</span>
        ${s.warn ? `<div class="text-[10px] text-amber-500">${s.warnLabel}</div>` : ''}
      </div>
    </div>`).join('');

  const stepperDesktop = steps.map((s, i) => {
    const isLast = i === steps.length - 1;
    const lineColor = s.done ? 'bg-blue-500' : s.warn ? 'bg-amber-300' : 'bg-slate-200';
    return `<div class="flex items-center ${isLast ? '' : 'flex-1'}">
      <div class="flex flex-col items-center">
        <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${stepColor(s)}">
          ${stepIcon(s)}
        </div>
        <div class="text-[10px] mt-1 text-center leading-tight w-16 ${s.warn ? 'text-amber-500 font-medium' : 'text-slate-400'}">${s.warn ? s.warnLabel : s.label}</div>
      </div>
      ${!isLast ? `<div class="h-0.5 flex-1 mb-4 mx-1 ${lineColor}"></div>` : ''}
    </div>`;
  }).join('');

  const history = (conv.history || []).map(m => {
    const isUser = m.role === 'user';
    return `<div class="flex ${isUser ? 'justify-start' : 'justify-end'} mb-2">
      <div class="max-w-[80%] px-3 py-2 rounded-2xl ${isUser ? 'bg-slate-100 rounded-tl-sm' : 'bg-blue-100 rounded-tr-sm'}">
        <div class="text-[10px] ${isUser ? 'text-slate-400' : 'text-blue-400'} mb-1 font-medium">${isUser ? '👤 Cliente' : '🤖 Asistente'}</div>
        <div class="text-sm whitespace-pre-wrap">${escapeHtml(m.content)}</div>
      </div>
    </div>`;
  }).join('');

  const timeline = (conv.timeline || []).slice().reverse().map(ev => {
    const date = new Date(ev.date + (ev.date.endsWith('Z') ? '' : 'Z')).toLocaleString('es-AR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    return `<div class="flex gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div class="text-base flex-shrink-0">${timelineIcon(ev.event)}</div>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-semibold text-slate-700">${escapeHtml(ev.event.replace(/_/g,' '))}</div>
        ${ev.note ? `<div class="text-xs text-slate-500 mt-0.5">${escapeHtml(ev.note)}</div>` : ''}
        <div class="text-[10px] text-slate-400 mt-0.5">${date}</div>
      </div>
    </div>`;
  }).join('');

  const stageOptions = STAGES.map(s =>
    `<option value="${s.key}" ${s.key === conv.client_stage ? 'selected' : ''}>${s.label}</option>`).join('');

  const funcList = (proyecto.funcionalidades || []).map(f =>
    `<li class="flex items-start gap-2 text-sm"><span class="text-blue-500">✓</span><span>${escapeHtml(f)}</span></li>`).join('');

  const demosDir = path.join(__dirname, '..', 'data', 'demos', slug);
  const demoFileLinks = conv.demo_status && conv.demo_status !== 'none' ? [
    fs.existsSync(path.join(demosDir, 'landing.html'))    ? `<a href="/demos/${slug}/landing.html" target="_blank" class="flex items-center gap-2 text-xs text-blue-600 hover:underline">🌐 Ver landing</a>` : '',
    fs.existsSync(path.join(demosDir, 'whatsapp.html'))   ? `<a href="/demos/${slug}/whatsapp.html" target="_blank" class="flex items-center gap-2 text-xs text-blue-600 hover:underline">💬 Ver mockup WhatsApp</a>` : '',
    fs.existsSync(path.join(demosDir, 'propuesta.pdf'))   ? `<a href="/demos/${slug}/propuesta.pdf" target="_blank" class="flex items-center gap-2 text-xs text-blue-600 hover:underline">📄 Ver PDF</a>` : '',
  ].filter(Boolean) : [];
  const demoLinks = demoFileLinks.length ? `<div class="space-y-2 mb-4 pt-3 border-t border-slate-100">${demoFileLinks.join('')}</div>` : '';

  // Version history for client detail page
  let clientVersionsHtml = '';
  try {
    const vFile = path.join(demosDir, 'versions.json');
    if (fs.existsSync(vFile)) {
      const versions = JSON.parse(fs.readFileSync(vFile, 'utf-8'));
      if (versions.length > 0) {
        const vRows = versions.map(function(v) {
          const d = new Date(v.date);
          const ds = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          const links = ['landing.html', 'whatsapp.html', 'propuesta.pdf'].filter(function(f) {
            return fs.existsSync(path.join(demosDir, 'v' + v.version, f));
          }).map(function(f) {
            const label = f.includes('landing') ? 'Landing' : f.includes('whatsapp') ? 'WA' : 'PDF';
            return '<a href="/demos/' + slug + '/v' + v.version + '/' + f + '" target="_blank" class="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200">' + label + '</a>';
          }).join(' ');
          return '<div class="flex items-center justify-between py-1.5">' +
            '<div class="flex items-center gap-1.5"><span class="text-[10px] font-bold text-slate-400">v' + v.version + '</span><span class="text-[10px] text-slate-400">' + ds + '</span></div>' +
            '<div class="flex gap-1">' + links + '</div></div>';
        }).join('');
        clientVersionsHtml = '<div class="border-t border-slate-100 pt-2 mt-2"><div class="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Versiones anteriores</div>' + vRows + '</div>';
      }
    }
  } catch(e) {}

  const infoRows = [
    ['Tipo', proyecto.tipo], ['Plataforma', proyecto.plataforma],
    ['Estado actual', proyecto.estado_actual], ['Stack', requisitos.stack_sugerido],
    ['Presupuesto', requisitos.presupuesto], ['Plazo', requisitos.plazo], ['Urgencia', requisitos.urgencia],
  ].filter(([, v]) => v);

  const body = `
    <div class="mb-5"><a href="/admin/clients" class="text-sm text-slate-500 hover:text-blue-600">← Pipeline</a></div>
    ${conv.archived ? `<div class="bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium px-4 py-2.5 rounded-xl mb-4">📦 Este contacto está archivado</div>` : ''}
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
      <div>
        <h1 class="text-xl md:text-2xl font-bold text-slate-900">${escapeHtml(nombre)}</h1>
        <div class="flex items-center gap-2 mt-1 text-xs text-slate-400">
          <span>${escapeHtml(phone)}</span>${email ? `<span>·</span><span>${escapeHtml(email)}</span>` : ''}
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">${stageBadge(conv.client_stage)} ${demoStatusBadge(conv.demo_status)}</div>
    </div>

    <div class="flex items-center gap-2 mb-4 flex-wrap">
      ${conv.archived
        ? `<form method="POST" action="/admin/unarchive/${phoneUrl}" class="inline">
        <button class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-600 hover:text-emerald-700 rounded-lg text-xs font-medium transition-colors">📦 Desarchivar</button>
      </form>`
        : `<form method="POST" action="/admin/archive/${phoneUrl}" class="inline">
        <button class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 rounded-lg text-xs font-medium transition-colors">📦 Archivar</button>
      </form>`}
      <form method="POST" action="/admin/reset-conv/${phoneUrl}" class="inline" onsubmit="return confirm('Esto borra toda la conversación y reinicia el contacto. ¿Seguro?')">
        <button class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-600 hover:text-amber-700 rounded-lg text-xs font-medium transition-colors">🔄 Resetear</button>
      </form>
      <form method="POST" action="/admin/delete-conv/${phoneUrl}" class="inline" onsubmit="return confirm('BORRAR PERMANENTE. No se puede deshacer. ¿Seguro?')">
        <button class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 hover:text-red-600 rounded-lg text-xs font-medium transition-colors">🗑️ Eliminar</button>
      </form>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-slate-700">Progreso del proceso</h2>
        <span class="text-xs text-slate-400">${doneCount} de ${steps.length} pasos</span>
      </div>
      <!-- Mobile: lista compacta en 2 columnas -->
      <div class="md:hidden grid grid-cols-2 gap-x-4">${stepperMobile}</div>
      <!-- Desktop: stepper horizontal -->
      <div class="hidden md:flex items-start overflow-x-auto pb-1">${stepperDesktop}</div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="lg:col-span-2 space-y-5">
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-4">Proyecto</h2>
          ${resumen ? `<p class="text-sm text-slate-600 mb-4 leading-relaxed">${escapeHtml(resumen)}</p>` : ''}
          ${infoRows.length ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">${infoRows.map(([k,v]) => `<div><div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">${k}</div><div class="text-slate-700 font-medium">${escapeHtml(v)}</div></div>`).join('')}</div>` : ''}
          ${funcList ? `<div class="mt-4 pt-4 border-t border-slate-100"><div class="text-xs text-slate-400 uppercase tracking-wide mb-2">Funcionalidades</div><ul class="space-y-1.5">${funcList}</ul></div>` : ''}
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-slate-700">Conversacion <span id="msg-count">(${(conv.history||[]).length} mensajes)</span></h2>
            <div class="flex items-center gap-2">
              <span id="live-dot" class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Auto-refresh activo"></span>
              <span id="live-status" class="text-[10px] text-slate-400">En vivo</span>
              <button onclick="toggleLive()" id="live-toggle" class="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">Pausar</button>
            </div>
          </div>
          <div id="chat-container" class="max-h-96 overflow-y-auto pr-1">${history || '<p class="text-sm text-slate-400">Sin mensajes</p>'}</div>
        </div>
        <script>
(function(){
  var phone = ${JSON.stringify(phone)};
  var lastCount = ${(conv.history||[]).length};
  var liveOn = true;
  var interval;

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  function renderMsg(m){
    var isUser = m.role === 'user';
    return '<div class="flex '+(isUser?'justify-start':'justify-end')+' mb-2">'+
      '<div class="max-w-[80%] px-3 py-2 rounded-2xl '+(isUser?'bg-slate-100 rounded-tl-sm':'bg-blue-100 rounded-tr-sm')+'">'+
      '<div class="text-[10px] '+(isUser?'text-slate-400':'text-blue-400')+' mb-1 font-medium">'+(isUser?'\\u{1F464} Cliente':'\\u{1F916} Asistente')+'</div>'+
      '<div class="text-sm whitespace-pre-wrap">'+esc(m.content)+'</div>'+
      '</div></div>';
  }

  function refresh(){
    fetch('/admin/api/conversation/'+encodeURIComponent(phone))
      .then(function(r){return r.json();})
      .then(function(data){
        if(data.messageCount !== lastCount){
          lastCount = data.messageCount;
          document.getElementById('msg-count').textContent = '('+lastCount+' mensajes)';
          var container = document.getElementById('chat-container');
          container.innerHTML = data.history.map(renderMsg).join('');
          container.scrollTop = container.scrollHeight;
          container.style.borderColor = '#3b82f6';
          setTimeout(function(){ container.style.borderColor = ''; }, 1000);
        }
      })
      .catch(function(e){console.error('refresh error',e);});
  }

  function startLive(){ interval = setInterval(refresh, 5000); }
  function stopLive(){ clearInterval(interval); }

  window.toggleLive = function(){
    liveOn = !liveOn;
    if(liveOn){ startLive(); }else{ stopLive(); }
    document.getElementById('live-dot').className = liveOn ? 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse' : 'w-2 h-2 rounded-full bg-slate-300';
    document.getElementById('live-status').textContent = liveOn ? 'En vivo' : 'Pausado';
    document.getElementById('live-toggle').textContent = liveOn ? 'Pausar' : 'Reanudar';
  };

  startLive();
  var c = document.getElementById('chat-container');
  if(c) c.scrollTop = c.scrollHeight;
})();
        </script>
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-2">Historial de eventos</h2>
          <div class="max-h-72 overflow-y-auto">${timeline || '<p class="text-sm text-slate-400">Sin eventos registrados</p>'}</div>
        </div>
      </div>

      <div class="space-y-5">
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-slate-700">Acciones</h2>
            <span class="text-[10px] px-2 py-0.5 rounded-full ${
              conv.demo_status === 'generating' ? 'bg-yellow-100 text-yellow-700 animate-pulse' :
              conv.demo_status === 'pending_review' ? 'bg-orange-100 text-orange-700' :
              conv.demo_status === 'rejected' ? 'bg-red-100 text-red-600' :
              conv.demo_status === 'changes_requested' ? 'bg-violet-100 text-violet-700' :
              conv.demo_status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
              conv.demo_status === 'approved' ? 'bg-green-100 text-green-700' :
              'bg-slate-100 text-slate-500'
            }">${
              conv.demo_status === 'generating' ? 'Generando...' :
              conv.demo_status === 'pending_review' ? 'Esperando review' :
              conv.demo_status === 'rejected' ? 'Rechazada' :
              conv.demo_status === 'changes_requested' ? 'Con correcciones' :
              conv.demo_status === 'sent' ? 'Enviado' :
              conv.demo_status === 'approved' ? 'Aprobado' :
              !conv.report ? 'Sin reporte' : 'Listo'
            }</span>
          </div>

          ${/* ── Estado: Generando ── */
            conv.demo_status === 'generating'
              ? `<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-3">
                   <div class="flex items-center gap-3 mb-3">
                     <div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                       <svg class="w-5 h-5 text-yellow-600 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                     </div>
                     <div>
                       <div class="text-sm font-semibold text-yellow-800">Generando demos...</div>
                       <div class="text-[10px] text-yellow-600" id="demo-elapsed">Calculando...</div>
                     </div>
                   </div>
                   <div class="space-y-2 mb-3">
                     <div class="flex items-center gap-2 text-[11px] text-yellow-700"><span class="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span> Landing HTML personalizada</div>
                     <div class="flex items-center gap-2 text-[11px] text-yellow-700"><span class="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span> Mockup de WhatsApp</div>
                     <div class="flex items-center gap-2 text-[11px] text-yellow-700"><span class="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span> Propuesta PDF</div>
                   </div>
                   <div id="demo-stuck" class="hidden bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                     <div class="text-xs font-medium text-red-700 mb-1">&#9888;&#65039; Posiblemente trabado</div>
                     <div class="text-[10px] text-red-600">Lleva m&aacute;s de 2 minutos. Pod&eacute;s reintentar.</div>
                   </div>
                   <form method="POST" action="/admin/regenerate/${phoneUrl}" onsubmit="this.querySelector('button').disabled=true;">
                     <button id="retry-btn" class="w-full bg-yellow-100 hover:bg-yellow-200 text-yellow-800 py-2 rounded-lg text-xs font-medium transition-colors border border-yellow-300">&#128260; Reintentar generaci&oacute;n</button>
                   </form>
                 </div>
                 <script>
                 (function(){
                   var started = ${JSON.stringify(conv.demo_started_at || '')};
                   if(!started) return;
                   var startTime = new Date(started).getTime();
                   function update(){
                     var elapsed = Math.floor((Date.now() - startTime) / 1000);
                     var min = Math.floor(elapsed / 60);
                     var sec = elapsed % 60;
                     var el = document.getElementById('demo-elapsed');
                     if(el) el.textContent = (min > 0 ? min + ' min ' : '') + sec + 's transcurridos';
                     if(elapsed > 120){
                       var stuckEl = document.getElementById('demo-stuck');
                       if(stuckEl) stuckEl.classList.remove('hidden');
                     }
                   }
                   update();
                   setInterval(update, 1000);
                   setTimeout(function(){ location.reload(); }, 10000);
                 })();
                 </script>`

          : /* ── Estado: Pendiente de review ── */
            conv.demo_status === 'pending_review'
              ? `<a href="/admin/review/${phoneUrl}" class="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl text-sm font-bold mb-3 transition-colors shadow-md shadow-orange-200">
                   <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                   Revisar demos
                 </a>`

          : /* ── Estado: Rechazada ── */
            conv.demo_status === 'rejected'
              ? `<div class="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-3">
                   <div class="flex items-center gap-2 mb-2">
                     <span class="text-lg">&#10060;</span>
                     <span class="text-sm font-bold text-red-700">Demo rechazada</span>
                   </div>
                   ${conv.demo_notes ? `<div class="text-xs text-red-600 bg-red-100/50 rounded-lg px-3 py-2 mb-3 whitespace-pre-line italic border border-red-100">"${escapeHtml(conv.demo_notes)}"</div>` : ''}
                   <div class="space-y-2">
                     <form method="POST" action="/admin/regenerate/${phoneUrl}" onsubmit="this.querySelector('button').disabled=true;this.querySelector('button').textContent='Regenerando...'">
                       <button class="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">&#128260; Regenerar desde cero</button>
                     </form>
                     <a href="/admin/review/${phoneUrl}" class="flex items-center justify-center gap-2 w-full border border-red-200 text-red-600 hover:bg-red-50 py-2 rounded-xl text-xs font-medium transition-colors">Volver a revisar con cambios</a>
                   </div>
                 </div>`

          : /* ── Estado: Con correcciones ── */
            conv.demo_status === 'changes_requested'
              ? `<div class="bg-violet-50 border border-violet-200 rounded-xl p-3 mb-3">
                   ${conv.demo_notes ? `<div class="text-xs text-violet-700 whitespace-pre-line mb-2">"${escapeHtml(conv.demo_notes)}"</div>` : ''}
                   <a href="/admin/review/${phoneUrl}" class="flex items-center justify-center gap-2 w-full bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">&#9998; Ver / aprobar correcciones</a>
                 </div>`

          : /* ── Estado: Enviado/Aprobado y no ganado ── */
            (conv.demo_status === 'sent' || conv.demo_status === 'approved') && conv.client_stage !== 'won'
              ? `<div class="space-y-2 mb-3">
                   <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-2">
                     <div class="flex items-center gap-2 mb-1">
                       <span class="text-sm">&#9992;&#65039;</span>
                       <span class="text-xs font-semibold text-emerald-800">Demo enviado al cliente</span>
                     </div>
                     <div class="text-[10px] text-emerald-600">Esperando respuesta del cliente</div>
                   </div>
                   <div class="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-1 mt-3">&iquest;Qu&eacute; respondi&oacute; el cliente?</div>
                   <a href="/admin/client/${phoneUrl}/to-project" class="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm">&#10004; Aprob&oacute; &mdash; confirmar proyecto</a>
                   <form method="POST" action="/admin/resend-demo/${phoneUrl}" onsubmit="this.querySelector('button').disabled=true;this.querySelector('button').textContent='Reenviando...';">
                     <button class="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-2.5 rounded-xl text-xs font-medium transition-colors border border-blue-200">&#128233; Reenviar demo al cliente</button>
                   </form>
                   <form method="POST" action="/admin/request-client-changes/${phoneUrl}" onsubmit="this.querySelector('button').disabled=true;">
                     <button class="w-full bg-amber-50 hover:bg-amber-100 text-amber-700 py-2.5 rounded-xl text-xs font-medium transition-colors border border-amber-200">&#9998; Quiere cambios &mdash; modificar demo</button>
                   </form>
                   <form method="POST" action="/admin/schedule-meeting/${phoneUrl}" onsubmit="this.querySelector('button').disabled=true;this.querySelector('button').textContent='Enviando horarios...';">
                     <button class="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2.5 rounded-xl text-xs font-medium transition-colors border border-indigo-200">&#128197; Programar reuni&oacute;n</button>
                   </form>
                   <form method="POST" action="/admin/mark-lost/${phoneUrl}" onsubmit="return confirm('&iquest;Marcar como perdido?');">
                     <button class="w-full bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 py-2 rounded-xl text-[10px] font-medium transition-colors border border-slate-200">No le interes&oacute; &mdash; marcar como perdido</button>
                   </form>
                 </div>`

          : /* ── Ganado ── */
            conv.client_stage === 'won' && conv.report
              ? `<a href="/admin/client/${phoneUrl}/to-project" class="flex items-center justify-center gap-2 w-full border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 py-2.5 rounded-xl text-sm font-semibold mb-3 transition-colors">&#128193; Ver / editar proyecto</a>`

          : /* ── Tiene reporte pero no hay demo ── */
            conv.report
              ? `<a href="/admin/client/${phoneUrl}/to-project" class="flex items-center justify-center gap-2 w-full bg-slate-700 hover:bg-slate-800 text-white py-2.5 rounded-xl text-sm font-semibold mb-3 transition-colors">&#128193; Convertir en proyecto</a>`

          : /* ── Sin reporte, conversación activa ── */
            (conv.history||[]).length > 0
              ? `<div class="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 text-center">
                   <div class="text-xs text-slate-500">Conversaci&oacute;n en curso</div>
                   <div class="text-[10px] text-slate-400 mt-0.5">${(conv.history||[]).length} mensajes intercambiados</div>
                 </div>`
            : ''}

          ${!conv.report && (conv.history||[]).length > 3 ? `
          <form method="POST" action="/admin/force-report/${phoneUrl}" class="mb-3" onsubmit="this.querySelector('button').disabled=true;this.querySelector('button').textContent='Generando...'">
            <button class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">&#128203; Generar reporte manualmente</button>
          </form>` : ''}
          ${conv.report && !['pending_review','rejected','generating'].includes(conv.demo_status) ? `
          <form method="POST" action="/admin/regenerate/${phoneUrl}" class="mb-3" onsubmit="this.querySelector('button').disabled=true;this.querySelector('button').textContent='Regenerando...'">
            <button class="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 rounded-xl text-xs font-medium transition-colors border border-blue-200">&#128260; Regenerar demos</button>
          </form>` : ''}

          <div class="border-t border-slate-100 pt-3 mt-1 space-y-2">
            <a href="https://wa.me/${phoneSlug(phone)}" target="_blank" class="flex items-center justify-center gap-2 w-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50 py-2 rounded-xl text-xs font-medium transition-colors">&#128172; Abrir en WhatsApp</a>
            ${demoLinks}
            ${conv.drive_folder_id ? `<a href="https://drive.google.com/drive/folders/${escapeHtml(conv.drive_folder_id)}" target="_blank" class="flex items-center justify-center gap-2 w-full border border-slate-200 text-slate-600 hover:bg-slate-50 py-2 rounded-xl text-xs transition-colors">&#128193; Drive</a>` : ''}
          </div>
          ${clientVersionsHtml}
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-3">Etapa</h2>
          <form method="POST" action="/admin/stage/${phoneUrl}">
            <select name="stage" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500">${stageOptions}</select>
            <button class="w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-xl text-sm transition-colors">Guardar etapa</button>
          </form>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-3">Checklist</h2>
          <div class="space-y-2">${steps.map(s => `
            <div class="flex items-center gap-2.5">
              <div class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-blue-600' : 'border-2 border-slate-200'}">
                ${s.done ? '<svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
              </div>
              <span class="text-sm ${s.done ? 'text-slate-700' : 'text-slate-400'}">${s.label}</span>
            </div>`).join('')}
          </div>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-3">Notas internas</h2>
          <form method="POST" action="/admin/notes/${phoneUrl}">
            <textarea name="notes" rows="4" placeholder="Notas sobre este cliente..."
              class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500">${escapeHtml(conv.notes || '')}</textarea>
            <button class="mt-2 w-full border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 rounded-xl text-sm transition-colors">Guardar notas</button>
          </form>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-3">Cliente CRM</h2>
          ${matchedClient ? `
            <div class="flex items-center gap-2.5 mb-3">
              ${(() => {
                const colors = ['bg-blue-100 text-blue-600','bg-purple-100 text-purple-600','bg-emerald-100 text-emerald-600'];
                const c = colors[matchedClient.name.split('').reduce((a,ch) => a + ch.charCodeAt(0), 0) % colors.length];
                return `<div class="w-8 h-8 rounded-full ${c} flex items-center justify-center font-bold text-sm">${(matchedClient.name[0]||'?').toUpperCase()}</div>`;
              })()}
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-slate-800 truncate">${escapeHtml(matchedClient.name)}</div>
                ${matchedClient.company ? `<div class="text-xs text-slate-400">${escapeHtml(matchedClient.company)}</div>` : ''}
              </div>
            </div>
            <a href="/admin/clientes/${matchedClient.id}" class="flex items-center justify-center gap-2 w-full border border-blue-200 text-blue-600 hover:bg-blue-50 py-2 rounded-xl text-sm font-medium transition-colors">Ver ficha del cliente →</a>
          ` : `
            <p class="text-xs text-slate-400 mb-3">Este lead no está vinculado a ningún cliente registrado.</p>
            <a href="/admin/clientes/new?phone=${encodeURIComponent(conv.phone)}&name=${encodeURIComponent(conv.report?.cliente?.nombre || '')}&email=${encodeURIComponent(conv.report?.cliente?.email || '')}"
               class="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
              + Crear cliente desde este lead
            </a>
          `}
        </div>
      </div>
    </div>`;

  res.send(layout(nombre, body, { pendingCount, activePage: 'clients', user: req.session?.user }));
});

// ─── Confirmar proyecto ganado desde lead WA ─────────────────────────────────

router.get('/client/:phone/to-project', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  const conv = await db.getConversation(phone);
  if (!conv?.report) return res.redirect(`/admin/client/${encodeURIComponent(phone)}`);

  const r = conv.report;
  const nombre = r.cliente?.nombre || phone;
  const tipo = r.proyecto?.tipo || '';
  const presupuesto = r.requisitos?.presupuesto || '';
  const phoneUrl = encodeURIComponent(phone);
  const slug = phoneSlug(phone);
  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;

  const funcionalidades = (r.proyecto?.funcionalidades || []);
  const hasLanding = fs.existsSync(path.join(__dirname, '..', 'data', 'demos', slug, 'landing.html'));
  const hasPDF     = fs.existsSync(path.join(__dirname, '..', 'data', 'demos', slug, 'propuesta.pdf'));

  const body = `
    <div class="mb-5 flex items-center gap-2 text-sm text-slate-500">
      <a href="/admin/client/${phoneUrl}" class="hover:text-blue-600">← ${escapeHtml(nombre)}</a>
      <span>/</span><span>Confirmar proyecto</span>
    </div>

    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-lg">🏆</div>
      <div>
        <h1 class="text-xl md:text-2xl font-bold text-slate-900">Confirmar proyecto ganado</h1>
        <div class="text-sm text-slate-400 mt-0.5">Este lead se convierte en proyecto activo</div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Formulario principal -->
      <div class="lg:col-span-2">
        <form method="POST" action="/admin/client/${phoneUrl}/to-project">
          <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">

            <div>
              <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Título del proyecto</label>
              <input type="text" name="title" required value="${escapeHtml(tipo ? tipo + ' — ' + nombre : nombre)}"
                class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Presupuesto acordado</label>
                <input type="text" name="budget" placeholder="Ej: $300 USD, $150.000 ARS"
                  value="${escapeHtml(presupuesto)}"
                  class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Estado del pago</label>
                <select name="budget_status" class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="not_quoted">Sin cotizar</option>
                  <option value="quoted">Cotizado</option>
                  <option value="approved" selected>Aprobado ✓</option>
                  <option value="partial">Pago parcial</option>
                  <option value="paid">Pagado ✓</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Estado del proyecto</label>
                <select name="status" class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="planning" selected>Planificando</option>
                  <option value="in_progress">En curso</option>
                  <option value="waiting_client">Esperando cliente</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Categoría</label>
                <select name="category" class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  ${PROJECT_CATEGORIES.map(c => `<option value="${c.key}" ${c.key==='cliente'?'selected':''}>${c.dot} ${c.label}</option>`).join('')}
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fecha límite (opcional)</label>
              <input type="date" name="deadline"
                class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notas adicionales</label>
              <textarea name="notes" rows="3" placeholder="Acuerdos, condiciones, detalles importantes..."
                class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"></textarea>
            </div>

            ${funcionalidades.length > 0 ? `
            <div>
              <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Alcance del proyecto (funcionalidades solicitadas)</label>
              <div class="bg-slate-50 rounded-xl p-3 space-y-1.5">
                ${funcionalidades.map(f => '<div class="flex items-start gap-2 text-sm text-slate-600"><span class="text-blue-500 mt-0.5">' + String.fromCharCode(9656) + '</span>' + escapeHtml(f) + '</div>').join('')}
              </div>
            </div>` : ''}

            <div>
              <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tareas iniciales de gesti&oacute;n</label>
              <div class="space-y-1.5">
                ${['Reunión inicial con el cliente', 'Definir alcance detallado y cronograma', 'Diseño UI/UX y wireframes', 'Desarrollo del MVP', 'Testing y revisión con el cliente', 'Ajustes finales y deploy', 'Entrega + soporte 30 días'].map((t, i) => '<label class="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer hover:text-slate-900">' +
                  '<input type="checkbox" name="mgmt_task_' + i + '" value="' + escapeHtml(t) + '" checked class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500">' +
                  escapeHtml(t) + '</label>').join('')}
              </div>
            </div>

            <!-- Campos ocultos del lead -->
            <input type="hidden" name="from_lead" value="${phoneUrl}">
            <input type="hidden" name="client_name" value="${escapeHtml(r.cliente?.nombre || '')}">
            <input type="hidden" name="client_phone" value="${escapeHtml(phoneSlug(phone))}">
            <input type="hidden" name="client_email" value="${escapeHtml(r.cliente?.email || '')}">
            <input type="hidden" name="type" value="${escapeHtml(tipo)}">
            <input type="hidden" name="description" value="${escapeHtml([r.proyecto?.descripcion, r.resumen_ejecutivo].filter(Boolean).join('\n\n'))}">
            <input type="hidden" name="scope" value="${escapeHtml(JSON.stringify(funcionalidades))}">

          </div>

          <button type="submit" class="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
            🏆 Confirmar proyecto y marcar lead como ganado
          </button>
        </form>
      </div>

      <!-- Panel lateral: resumen del lead -->
      <div class="space-y-4">
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Datos del lead</h2>
          <div class="space-y-3">
            <div><div class="text-[10px] text-slate-400 uppercase tracking-wide">Cliente</div><div class="text-sm font-medium text-slate-800">${escapeHtml(nombre)}</div></div>
            ${r.cliente?.email ? `<div><div class="text-[10px] text-slate-400 uppercase tracking-wide">Email</div><div class="text-sm text-slate-700">${escapeHtml(r.cliente.email)}</div></div>` : ''}
            ${tipo ? `<div><div class="text-[10px] text-slate-400 uppercase tracking-wide">Tipo</div><div class="text-sm text-slate-700">${escapeHtml(tipo)}</div></div>` : ''}
            ${presupuesto ? `<div><div class="text-[10px] text-slate-400 uppercase tracking-wide">Presupuesto mencionado</div><div class="text-sm text-slate-700">${escapeHtml(presupuesto)}</div></div>` : ''}
            ${r.requisitos?.plazo ? `<div><div class="text-[10px] text-slate-400 uppercase tracking-wide">Plazo</div><div class="text-sm text-slate-700">${escapeHtml(r.requisitos.plazo)}</div></div>` : ''}
          </div>
        </div>

        ${(hasLanding || hasPDF) ? `
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Demos generados</h2>
          <div class="space-y-2">
            ${hasLanding ? `<a href="/demos/${slug}/landing.html" target="_blank" class="flex items-center gap-2 text-sm text-blue-600 hover:underline">🌐 Ver landing page</a>` : ''}
            ${hasPDF ? `<a href="/demos/${slug}/propuesta.pdf" target="_blank" class="flex items-center gap-2 text-sm text-blue-600 hover:underline">📄 Ver propuesta PDF</a>` : ''}
          </div>
          <p class="text-xs text-slate-400 mt-3">Los demos quedan linkados al proyecto automáticamente.</p>
        </div>` : ''}

        <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <div class="text-xs font-semibold text-emerald-700 mb-1">Al confirmar:</div>
          <ul class="text-xs text-emerald-600 space-y-1">
            <li>✓ Se crea el proyecto con todos los datos</li>
            <li>✓ El lead pasa a estado <strong>Ganado 🏆</strong></li>
            <li>✓ Las funcionalidades quedan como alcance del proyecto</li>
            <li>✓ Se pre-cargan tareas de gestión</li>
            <li>✓ Los demos quedan vinculados</li>
          </ul>
        </div>
      </div>
    </div>`;

  res.send(layout('Confirmar proyecto', body, { pendingCount, activePage: 'projects', user: req.session?.user }));
});

router.post('/client/:phone/to-project', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  const conv = await db.getConversation(phone);
  if (!conv?.report) return res.redirect(`/admin/client/${encodeURIComponent(phone)}`);

  const r = conv.report;
  const slug = phoneSlug(phone);
  const { title, budget, budget_status, status, category, deadline, notes, client_name, client_phone, client_email, type, description } = req.body;

  // Build management tasks (not functionalities)
  const tasks = [];
  const mgmtTasks = [
    'Reunión inicial con el cliente',
    'Definir alcance detallado y cronograma',
    'Diseño UI/UX y wireframes',
    'Desarrollo del MVP',
    'Testing y revisión con el cliente',
    'Ajustes finales y deploy',
    'Entrega + soporte 30 días'
  ];
  for (let i = 0; i < mgmtTasks.length; i++) {
    if (req.body['mgmt_task_' + i]) {
      tasks.push({ text: mgmtTasks[i], done: false, priority: i === 0 ? 'high' : 'medium', assignee: 'david' });
    }
  }

  // Store scope (functionalities) from the lead
  let scope = [];
  try { scope = JSON.parse(req.body.scope || '[]'); } catch(e) {}

  // Agregar nota de demos generados en la descripción
  const demoNote = [];
  if (fs.existsSync(path.join(__dirname, '..', 'data', 'demos', slug, 'landing.html')))
    demoNote.push(`🌐 Landing: ${(process.env.APP_URL || '').replace(/\/$/,'')}/demos/${slug}/landing.html`);
  if (fs.existsSync(path.join(__dirname, '..', 'data', 'demos', slug, 'propuesta.pdf')))
    demoNote.push(`📄 PDF: ${(process.env.APP_URL || '').replace(/\/$/,'')}/demos/${slug}/propuesta.pdf`);

  const scopeText = scope.length > 0 ? '--- Alcance ---\n' + scope.map(f => '\u2022 ' + f).join('\n') : '';
  const fullDescription = [description, scopeText, demoNote.length ? '--- Demos ---\n' + demoNote.join('\n') : ''].filter(Boolean).join('\n\n');

  const project = {
    client_name: client_name || r.cliente?.nombre || '',
    client_phone: client_phone || phoneSlug(phone),
    client_email: client_email || r.cliente?.email || '',
    title: title || type || client_name || '',
    type: type || '',
    description: fullDescription,
    budget: budget || '',
    budget_status: budget_status || 'approved',
    status: status || 'planning',
    category: category || 'cliente',
    deadline: deadline || '',
    notes: notes || '',
    tasks,          // array — createProject hace JSON.stringify internamente
    is_personal: false,
  };

  const newProjectId = await db.createProject(project); // devuelve string id

  // Marcar el lead como ganado
  await db.updateClientStage(phone, 'won');
  await db.appendTimelineEvent(phone, { event: 'stage_changed', note: `Proyecto ganado — creado proyecto #${newProjectId}` });

  res.redirect(`/admin/projects/${newProjectId}`);
});

// ─── Review ──────────────────────────────────────────────────────────────────

router.get('/review/:phone', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  const conv = await db.getConversation(phone);
  if (!conv) return res.status(404).send('No encontrado');

  const slug = phoneSlug(phone);
  const nombre = conv.report?.cliente?.nombre || phone;
  const phoneUrl = encodeURIComponent(phone);
  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;

  // Verificar qué archivos existen
  const DEMOS_DIR = path.join(__dirname, '..', 'data', 'demos');
  const localDir  = path.join(DEMOS_DIR, slug);
  const hasLanding = fs.existsSync(path.join(localDir, 'landing.html'));
  const hasWA      = fs.existsSync(path.join(localDir, 'whatsapp.html'));
  const hasPDF     = fs.existsSync(path.join(localDir, 'propuesta.pdf'));

  // Load version history
  const versionsFile = path.join(localDir, 'versions.json');
  let versions = [];
  try {
    if (fs.existsSync(versionsFile)) {
      versions = JSON.parse(fs.readFileSync(versionsFile, 'utf-8'));
    }
  } catch(e) {}

  const demoItems = [
    hasLanding && ['🌐 Landing HTML',         `/demos/${slug}/landing.html`,  'iframe'],
    hasWA      && ['💬 Mockup WhatsApp',       `/demos/${slug}/whatsapp.html`, 'iframe'],
    hasPDF     && ['📄 Mini-propuesta PDF',    `/demos/${slug}/propuesta.pdf`, 'pdf'],
  ].filter(Boolean);

  const demoPreviews = demoItems.map(([title, url, type]) => `
    <div class="bg-white rounded-2xl border border-slate-200 p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-slate-700">${title}</h2>
        <a href="${url}" target="_blank" class="text-xs text-blue-600 hover:underline">Abrir ↗</a>
      </div>
      ${type === 'iframe'
        ? `<iframe src="${url}" class="w-full rounded-xl border border-slate-100" style="height:560px"></iframe>`
        : `<object data="${url}" type="application/pdf" class="w-full rounded-xl border border-slate-100" style="height:560px"><a href="${url}" class="text-blue-600 text-sm hover:underline">Descargar PDF</a></object>`}
    </div>`).join('');

  // Nota de correcciones previas (si la hubiera)
  const prevNote = conv.demo_notes ? `
    <div class="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-5">
      <div class="text-xs font-semibold text-violet-600 mb-1">✏ Correcciones solicitadas antes</div>
      <p class="text-sm text-violet-800 whitespace-pre-line">${escapeHtml(conv.demo_notes)}</p>
    </div>` : '';

  const body = `
    <div class="mb-5"><a href="/admin/client/${phoneUrl}" class="text-sm text-slate-500 hover:text-blue-600">← ${escapeHtml(nombre)}</a></div>
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Revisar demos</h1>
        <div class="text-sm text-slate-400 mt-0.5">${escapeHtml(nombre)} · ${escapeHtml(phone)}</div>
      </div>
    </div>
    ${prevNote}
    ${versions.length > 0 ? `
    <div class="bg-white rounded-2xl border border-slate-200 p-4 mb-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-slate-700">Versiones anteriores</h2>
        <span class="text-[10px] text-slate-400">${versions.length} ${versions.length === 1 ? 'version anterior' : 'versiones anteriores'}</span>
      </div>
      <div class="space-y-2">
        ${versions.map(function(v) {
          var d = new Date(v.date);
          var dateStr = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          var vFiles = [];
          if (fs.existsSync(path.join(localDir, 'v' + v.version, 'landing.html'))) vFiles.push(['Landing', '/demos/' + slug + '/v' + v.version + '/landing.html']);
          if (fs.existsSync(path.join(localDir, 'v' + v.version, 'whatsapp.html'))) vFiles.push(['WhatsApp', '/demos/' + slug + '/v' + v.version + '/whatsapp.html']);
          if (fs.existsSync(path.join(localDir, 'v' + v.version, 'propuesta.pdf'))) vFiles.push(['PDF', '/demos/' + slug + '/v' + v.version + '/propuesta.pdf']);
          return '<div class="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">' +
            '<div class="flex items-center gap-2">' +
              '<span class="text-xs font-bold text-slate-500">v' + v.version + '</span>' +
              '<span class="text-[10px] text-slate-400">' + dateStr + '</span>' +
              (v.notes ? '<span class="text-[10px] text-violet-500 italic truncate max-w-[200px]">' + escapeHtml(v.notes) + '</span>' : '') +
            '</div>' +
            '<div class="flex gap-2">' +
              vFiles.map(function(f) {
                return '<a href="' + f[1] + '" target="_blank" class="text-[10px] px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded hover:bg-slate-100 transition-colors">' + f[0] + '</a>';
              }).join('') +
            '</div>' +
          '</div>';
        }).join('')}
      </div>
    </div>` : ''}
    ${demoItems.length === 0
      ? `<div class="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-700 text-sm mb-5">⚠ No hay archivos de demo generados todavía para este cliente.</div>`
      : `<div class="grid grid-cols-1 ${demoItems.length > 1 ? 'lg:grid-cols-' + Math.min(demoItems.length, 3) : ''} gap-5 mb-8">${demoPreviews}</div>`}

    <!-- Panel de acciones -->
    <div class="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl mx-auto">
      <h2 class="text-sm font-semibold text-slate-700 mb-5">¿Qué hacemos con esta demo?</h2>
      <div class="grid grid-cols-1 gap-4">

        <!-- Opción 1: Pedir cambios -->
        <details class="group border border-violet-200 rounded-xl overflow-hidden">
          <summary class="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-violet-50 text-sm font-medium text-violet-700 list-none">
            <span>✏ Pedir cambios antes de enviar</span>
            <span class="group-open:rotate-180 transition-transform text-violet-400">▼</span>
          </summary>
          <div class="px-4 pb-4 pt-2 bg-violet-50">
            <p class="text-xs text-violet-600 mb-2">Describí qué querés que cambie. El estado quedará como "Con correcciones" y vas a poder regenerar desde la ficha del cliente.</p>
            <form method="POST" action="/admin/request-changes/${phoneUrl}">
              <div class="flex items-center gap-2 mb-2">
                <button type="button" onclick="startRecording(this)" class="mic-btn flex items-center gap-1.5 px-3 py-1.5 bg-white border border-violet-300 text-violet-600 rounded-lg text-xs font-medium hover:bg-violet-50 transition-colors">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8M12 1a3 3 0 00-3 3v7a3 3 0 006 0V4a3 3 0 00-3-3z"/></svg>
                  Dictar por voz
                </button>
                <span class="mic-status text-[10px] text-slate-400 hidden"></span>
              </div>
              <textarea name="notes" rows="3" placeholder="Ej: Cambiar los colores a azul y blanco. El título principal debería decir 'Bienvenido a...'."
                class="w-full border border-violet-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 mb-3 bg-white"></textarea>
              <button class="w-full bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">Guardar correcciones</button>
            </form>
          </div>
        </details>

        <!-- Opción 2: Rechazar y regenerar -->
        <details class="group border border-red-200 rounded-xl overflow-hidden">
          <summary class="list-none cursor-pointer">
            <div class="flex items-center justify-between px-4 py-3 hover:bg-red-50 transition-colors">
              <span class="text-sm font-medium text-red-600">✗ Rechazar y regenerar</span>
              <span class="group-open:rotate-180 transition-transform text-red-400 text-xs">▼</span>
            </div>
          </summary>
          <div class="px-4 pb-4 pt-2 bg-red-50">
            <p class="text-xs text-red-600 mb-2">La demo no quedó bien. Agregá una nota de qué está mal y el sistema regenera automáticamente.</p>
            <form method="POST" action="/admin/reject/${phoneUrl}">
              <div class="flex items-center gap-2 mb-2">
                <button type="button" onclick="startRecording(this)" class="mic-btn flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8M12 1a3 3 0 00-3 3v7a3 3 0 006 0V4a3 3 0 00-3-3z"/></svg>
                  Dictar por voz
                </button>
                <span class="mic-status text-[10px] text-slate-400 hidden"></span>
              </div>
              <textarea name="notes" rows="2" placeholder="Ej: Los colores no van con el rubro, cambiar el título principal..."
                class="w-full border border-red-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 mb-3 bg-white"></textarea>
              <button class="w-full bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">🔄 Rechazar y regenerar ahora</button>
            </form>
          </div>
        </details>

        <!-- Opción 3: Aprobar -->
        <form method="POST" action="/admin/approve/${phoneUrl}">
          <button class="w-full px-6 py-3.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-semibold transition-colors">
            ✓ Aprobar y enviar al cliente ahora
          </button>
        </form>
      </div>
    </div>

    <script>
    var mediaRecorder = null;
    var audioChunks = [];

    function startRecording(btn) {
      var container = btn.closest('.group') || btn.closest('details');
      var textarea = container.querySelector('textarea');
      var status = btn.nextElementSibling;

      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        btn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8M12 1a3 3 0 00-3 3v7a3 3 0 006 0V4a3 3 0 00-3-3z"/></svg> Dictar por voz';
        btn.classList.remove('bg-red-500', 'text-white', 'border-red-500');
        return;
      }

      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function(stream) {
          audioChunks = [];
          mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

          mediaRecorder.ondataavailable = function(e) {
            if (e.data.size > 0) audioChunks.push(e.data);
          };

          mediaRecorder.onstop = function() {
            stream.getTracks().forEach(function(t) { t.stop(); });
            status.textContent = 'Transcribiendo...';
            status.classList.remove('hidden');

            var blob = new Blob(audioChunks, { type: 'audio/webm' });
            var formData = new FormData();
            formData.append('audio', blob, 'recording.webm');

            fetch('/admin/api/transcribe', { method: 'POST', body: formData })
              .then(function(r) { return r.json(); })
              .then(function(data) {
                if (data.text) {
                  textarea.value = textarea.value ? textarea.value + ' ' + data.text : data.text;
                  textarea.focus();
                }
                status.textContent = data.text ? 'Listo' : 'No se pudo transcribir';
                setTimeout(function() { status.classList.add('hidden'); }, 2000);
              })
              .catch(function(err) {
                status.textContent = 'Error al transcribir';
                setTimeout(function() { status.classList.add('hidden'); }, 2000);
              });
          };

          mediaRecorder.start();
          btn.innerHTML = '<span class="w-2 h-2 rounded-full bg-white animate-pulse inline-block"></span> Grabando... (click para parar)';
          btn.classList.add('bg-red-500', 'text-white', 'border-red-500');
          status.textContent = 'Grabando...';
          status.classList.remove('hidden');
        })
        .catch(function(err) {
          status.textContent = 'No se pudo acceder al microfono';
          status.classList.remove('hidden');
          setTimeout(function() { status.classList.add('hidden'); }, 3000);
        });
    }
    </script>`;

  res.send(layout('Revisar demos', body, { pendingCount, activePage: 'clients', user: req.session?.user }));
});

// ─── WA Actions ──────────────────────────────────────────────────────────────

router.post('/stage/:phone', requireAuth, async (req, res) => {
  const { stage } = req.body;
  if (!STAGES.find(s => s.key === stage)) return res.redirect(`/admin/client/${encodeURIComponent(req.params.phone)}`);
  await db.updateClientStage(req.params.phone, stage);
  await db.appendTimelineEvent(req.params.phone, { event: 'stage_changed', note: `Movido a "${STAGES.find(s=>s.key===stage)?.label||stage}"` });
  res.redirect(`/admin/client/${encodeURIComponent(req.params.phone)}`);
});

router.post('/approve/:phone', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  await db.updateDemoStatus(phone, 'approved');
  await db.appendTimelineEvent(phone, { event: 'demo_approved', note: 'Aprobado desde el panel' });
  try {
    await orchestrator.sendApprovedDemoToClient(phone);
  } catch (err) {
    console.error('Error enviando demo al cliente:', err);
  }
  res.redirect(`/admin/client/${encodeURIComponent(phone)}`);
});

router.post('/reject/:phone', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  const notes = (req.body.notes || '').trim();
  await db.updateDemoStatus(phone, 'rejected');
  if (notes) await db.setDemoNotes(phone, notes);
  await db.appendTimelineEvent(phone, { event: 'demo_rejected', note: notes || 'Rechazado desde el panel' });
  // Regenerar automáticamente
  const conv = await db.getConversation(phone);
  if (conv?.report) {
    orchestrator.processNewReport(phone, conv.report).catch(err => {
      console.error('[reject] Error regenerando demos:', err);
    });
  }
  res.redirect(`/admin/client/${encodeURIComponent(phone)}`);
});

router.post('/request-changes/:phone', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  const notes = (req.body.notes || '').trim();
  await db.updateDemoStatus(phone, 'changes_requested');
  await db.setDemoNotes(phone, notes);
  await db.appendTimelineEvent(phone, { event: 'changes_requested', note: notes || 'Correcciones solicitadas sin nota' });
  res.redirect(`/admin/client/${encodeURIComponent(phone)}`);
});

router.post('/regenerate/:phone', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  const conv = await db.getConversation(phone);
  if (conv?.report) orchestrator.processNewReport(phone, conv.report).catch(err => console.error('Error regenerando:', err));
  res.redirect(`/admin/client/${encodeURIComponent(phone)}`);
});

// Reenviar demo al cliente (mismo demo, no regenera)
router.post('/resend-demo/:phone', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  try {
    await orchestrator.sendApprovedDemoToClient(phone);
    await db.appendTimelineEvent(phone, { event: 'demo_resent', note: 'Demo reenviado desde el panel' });
  } catch (err) {
    console.error('Error reenviando demo:', err);
  }
  res.redirect(`/admin/client/${encodeURIComponent(phone)}`);
});

// Cliente quiere cambios → volver a generating
router.post('/request-client-changes/:phone', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  await db.updateDemoStatus(phone, 'changes_requested');
  await db.updateClientStage(phone, 'qualified');
  await db.appendTimelineEvent(phone, { event: 'client_wants_changes', note: 'El cliente pidió modificaciones después de ver el demo' });
  res.redirect(`/admin/review/${encodeURIComponent(phone)}`);
});

// Programar reunión → enviar slots por WhatsApp
router.post('/schedule-meeting/:phone', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  try {
    const calendar = require('./calendar');
    const calSlots = await calendar.getAvailableSlots();
    if (calSlots.length > 0) {
      const conv = await db.getConversation(phone);
      const slotsData = calSlots.map(s => ({ start: s.start.toISOString(), end: s.end.toISOString() }));
      await db.upsertConversation(phone, {
        stage: 'awaiting_slot',
        context: { ...(conv?.context || {}), pendingSlots: slotsData }
      });
      const slotsText = calendar.formatSlotsForWhatsApp(calSlots);
      const { sendMessage } = require('./whatsapp');
      const nombre = conv?.report?.cliente?.nombre || 'Hola';
      await sendMessage(phone, `${nombre}, ¡genial! Te paso 3 opciones para que coordinemos una llamada corta:\n\n${slotsText}\n\n¿Cuál te viene mejor?`);
      await db.updateClientStage(phone, 'negotiating');
      await db.appendTimelineEvent(phone, { event: 'meeting_slots_sent', note: 'Horarios enviados al cliente desde el panel' });
    } else {
      const { sendMessage } = require('./whatsapp');
      await sendMessage(phone, 'Hola! David te va a escribir en un rato para coordinar un horario para charlar. ¡Quedate atento!');
      await db.appendTimelineEvent(phone, { event: 'meeting_manual', note: 'No había slots disponibles, se avisó al cliente' });
    }
  } catch (err) {
    console.error('Error programando reunión:', err);
    await db.appendTimelineEvent(phone, { event: 'meeting_error', note: err.message });
  }
  res.redirect(`/admin/client/${encodeURIComponent(phone)}`);
});

// Marcar como perdido
router.post('/mark-lost/:phone', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  await db.updateClientStage(phone, 'lost');
  await db.appendTimelineEvent(phone, { event: 'marked_lost', note: 'Marcado como perdido desde el panel' });
  res.redirect(`/admin/client/${encodeURIComponent(phone)}`);
});

// Generar reporte manualmente para conversaciones que quedaron a mitad
router.post('/force-report/:phone', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  try {
    const conv = await db.getConversation(phone);
    if (!conv || !conv.history?.length) {
      return res.redirect(`/admin/client/${encodeURIComponent(phone)}?error=no_history`);
    }
    // Generar reporte a partir del historial existente
    const report = await generateReport(conv.history, phone);
    if (!report) {
      return res.redirect(`/admin/client/${encodeURIComponent(phone)}?error=report_failed`);
    }
    // Guardar reporte y marcar stage como done
    await db.upsertConversation(phone, { report, stage: 'done' });
    await db.appendTimelineEvent(phone, { event: 'report_generated', note: 'Generado manualmente desde el panel' });
    // Arrancar generación de demos
    orchestrator.processNewReport(phone, report).catch(err => console.error('Error en orchestrator (force):', err));
    res.redirect(`/admin/client/${encodeURIComponent(phone)}`);
  } catch (err) {
    console.error('Error en force-report:', err);
    res.redirect(`/admin/client/${encodeURIComponent(phone)}?error=exception`);
  }
});

router.post('/notes/:phone', requireAuth, async (req, res) => {
  await db.setNotes(req.params.phone, req.body.notes || '');
  res.redirect(`/admin/client/${encodeURIComponent(req.params.phone)}`);
});

// ─── Archive / Reset / Delete conversations ──────────────────────────────────

router.post('/archive/:phone', requireAuth, async (req, res) => {
  await db.archiveConversation(req.params.phone);
  await db.appendTimelineEvent(req.params.phone, { event: 'archived', note: 'Archivado desde el panel' });
  res.redirect('/admin/clients');
});

router.post('/unarchive/:phone', requireAuth, async (req, res) => {
  await db.unarchiveConversation(req.params.phone);
  await db.appendTimelineEvent(req.params.phone, { event: 'unarchived', note: 'Desarchivado desde el panel' });
  const referer = req.get('Referer') || '';
  if (referer.includes('/client/')) {
    res.redirect(`/admin/client/${encodeURIComponent(req.params.phone)}`);
  } else {
    res.redirect('/admin/clients?archived=1');
  }
});

router.post('/dismiss-action/:phone', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  const conv = await db.getConversation(phone);
  if (conv) {
    if (conv.demo_status === 'pending_review' || conv.demo_status === 'changes_requested') {
      await db.updateDemoStatus(phone, 'dismissed');
    } else if (conv.stage === 'awaiting_feedback') {
      await db.updateClientStage(phone, 'demo_sent');
      await db.upsertConversation(phone, { stage: 'done' });
    } else if (conv.stage === 'done' && (!conv.demo_status || conv.demo_status === 'none')) {
      await db.updateDemoStatus(phone, 'skipped');
    }
    await db.appendTimelineEvent(phone, { event: 'action_dismissed', note: 'Acción descartada manualmente' });
  }
  res.redirect('/admin/control');
});

router.post('/reset-conv/:phone', requireAuth, async (req, res) => {
  await db.resetConversation(req.params.phone);
  res.redirect(`/admin/client/${encodeURIComponent(req.params.phone)}`);
});

router.post('/delete-conv/:phone', requireAuth, async (req, res) => {
  await db.deleteConversation(req.params.phone);
  res.redirect('/admin/clients');
});

// ─── Notifications ───────────────────────────────────────────────────────────

// Redirect old notifications URL
router.get('/notifications', requireAuth, (req, res) => res.redirect('/admin/control'));

router.get('/control', requireAuth, async (req, res) => {
  // Fetch upcoming meetings from Google Calendar
  let upcomingMeetings = [];
  try {
    const calendar = require('./calendar');
    upcomingMeetings = await calendar.getUpcomingMeetings(5);
  } catch (e) {
    console.error('[control] Error fetching meetings:', e.message);
  }

  // Helper to format meeting dates with fallback
  const formatDate = (isoStr) => {
    try {
      const cal = require('./calendar');
      if (cal.formatMeetingDate) return cal.formatMeetingDate(isoStr);
    } catch(e) {}
    // Fallback
    const d = new Date(isoStr);
    return { full: d.toLocaleString('es-AR', { timeZone: 'America/Argentina/Salta', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + 'hs' };
  };

  const [notifications, allClients] = await Promise.all([
    db.getNotifications(100),
    db.listAllClients(),
  ]);
  await db.markAllNotificationsRead();

  const pendingCount = allClients.filter(c => c.demo_status === 'pending_review').length;
  const activeClients = allClients.filter(c => !c.archived);

  // ── Status counters ──
  const stats = {
    total: activeClients.length,
    gathering: activeClients.filter(c => ['greeting','gathering','confirming'].includes(c.stage)).length,
    done: activeClients.filter(c => c.stage === 'done').length,
    pendingReview: allClients.filter(c => c.demo_status === 'pending_review').length,
    generating: allClients.filter(c => c.demo_status === 'generating').length,
    awaitingFeedback: activeClients.filter(c => c.stage === 'awaiting_feedback').length,
    awaitingSlot: activeClients.filter(c => c.stage === 'awaiting_slot').length,
    meetings: activeClients.filter(c => c.stage === 'meeting_scheduled').length,
    won: activeClients.filter(c => c.client_stage === 'won').length,
    lost: activeClients.filter(c => c.client_stage === 'lost').length,
  };
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // ── Actionable items: things that need David's attention ──
  const pendingDemos = allClients.filter(c => c.demo_status === 'pending_review' && c.client_stage !== 'won' && c.client_stage !== 'lost');
  const changesRequested = allClients.filter(c => c.demo_status === 'changes_requested' && c.client_stage !== 'won' && c.client_stage !== 'lost');
  const clientsFeedback = activeClients.filter(c => c.stage === 'awaiting_feedback' && c.demo_status !== 'dismissed' && c.client_stage !== 'won' && c.client_stage !== 'lost');
  const reportsReady = activeClients.filter(c => c.stage === 'done' && c.report && (!c.demo_status || c.demo_status === 'none') && c.client_stage !== 'won' && c.client_stage !== 'lost');

  const actionItems = [];
  const actionBtn = (href, label, style) => `<a href="${href}" class="px-2.5 py-1 ${style} rounded-lg text-xs font-medium transition-colors">${label}</a>`;
  const actionForm = (action, label, style, confirm) =>
    `<form method="POST" action="${action}" class="inline"${confirm ? ` onsubmit="return confirm('${confirm}')"` : ''}>
      <button class="px-2.5 py-1 ${style} rounded-lg text-xs font-medium transition-colors">${label}</button>
    </form>`;

  pendingDemos.forEach(c => {
    const nombre = c.report?.cliente?.nombre || phoneSlug(c.phone);
    const ph = encodeURIComponent(c.phone);
    actionItems.push({
      priority: 1, icon: '👁', color: 'orange',
      title: `Revisar demo de ${escapeHtml(nombre)}`,
      subtitle: c.report?.proyecto?.tipo || '',
      actions: `${actionBtn(`/admin/review/${ph}`, 'Revisar', 'bg-orange-500 hover:bg-orange-600 text-white font-semibold')}
        ${actionForm(`/admin/approve/${ph}`, 'Aprobar', 'bg-emerald-500 hover:bg-emerald-600 text-white')}
        ${actionForm(`/admin/reject/${ph}`, 'Rechazar', 'bg-red-100 hover:bg-red-200 text-red-600 border border-red-200')}
        ${actionForm(`/admin/dismiss-action/${ph}`, 'Descartar acción', 'text-slate-400 hover:text-red-500 hover:bg-red-50', '¿Descartar esta acción pendiente?')}`,
      time: c.updated_at,
    });
  });
  changesRequested.forEach(c => {
    const nombre = c.report?.cliente?.nombre || phoneSlug(c.phone);
    const ph = encodeURIComponent(c.phone);
    actionItems.push({
      priority: 2, icon: '✏', color: 'violet',
      title: `Correcciones: ${escapeHtml(nombre)}`,
      subtitle: c.demo_notes ? `"${escapeHtml(c.demo_notes).slice(0, 80)}"` : '',
      actions: `${actionBtn(`/admin/review/${ph}`, 'Ver cambios', 'bg-violet-600 hover:bg-violet-700 text-white font-semibold')}
        ${actionForm(`/admin/regenerate/${ph}`, 'Regenerar', 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-200')}
        ${actionForm(`/admin/dismiss-action/${ph}`, 'Descartar acción', 'text-slate-400 hover:text-red-500 hover:bg-red-50', '¿Descartar esta acción pendiente?')}`,
      time: c.updated_at,
    });
  });
  reportsReady.forEach(c => {
    const nombre = c.report?.cliente?.nombre || phoneSlug(c.phone);
    const ph = encodeURIComponent(c.phone);
    actionItems.push({
      priority: 3, icon: '📋', color: 'indigo',
      title: `Reporte listo: ${escapeHtml(nombre)}`,
      subtitle: 'Reporte generado, demo no iniciado',
      actions: `${actionForm(`/admin/regenerate/${ph}`, 'Generar demo', 'bg-indigo-600 hover:bg-indigo-700 text-white font-semibold')}
        ${actionBtn(`/admin/client/${ph}`, 'Ver', 'border border-slate-200 text-slate-600 hover:bg-slate-50')}
        ${actionForm(`/admin/dismiss-action/${ph}`, 'Descartar acción', 'text-slate-400 hover:text-red-500 hover:bg-red-50', '¿Descartar esta acción pendiente?')}`,
      time: c.updated_at,
    });
  });
  clientsFeedback.forEach(c => {
    const nombre = c.report?.cliente?.nombre || phoneSlug(c.phone);
    const ph = encodeURIComponent(c.phone);
    actionItems.push({
      priority: 4, icon: '💬', color: 'blue',
      title: `Esperando respuesta: ${escapeHtml(nombre)}`,
      subtitle: 'Demo enviado, esperando feedback del cliente',
      actions: `${actionBtn(`/admin/client/${ph}`, 'Ver', 'border border-blue-200 text-blue-600 hover:bg-blue-50')}
        ${actionBtn(`https://wa.me/${phoneSlug(c.phone)}`, 'WhatsApp', 'border border-emerald-200 text-emerald-600 hover:bg-emerald-50')}
        ${actionForm(`/admin/dismiss-action/${ph}`, 'Descartar acción', 'text-slate-400 hover:text-red-500 hover:bg-red-50', '¿Descartar esta acción pendiente?')}`,
      time: c.updated_at,
    });
  });
  actionItems.sort((a, b) => a.priority - b.priority);

  const actionRows = actionItems.length === 0
    ? '<div class="text-center text-slate-400 py-8 text-sm">Todo al dia, no hay acciones pendientes</div>'
    : actionItems.map(a => `
      <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
        <span class="text-lg flex-shrink-0">${a.icon}</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-slate-800">${a.title}</div>
          ${a.subtitle ? `<div class="text-xs text-slate-400 mt-0.5 truncate">${a.subtitle}</div>` : ''}
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">${a.actions}</div>
      </div>`).join('');

  // ── Notification feed ──
  const typeIcon = { lead: '💬', demo: '🎨', meeting: '📅', warning: '⚠️', info: '📝' };
  const _timeAgo = (d) => {
    if (!d) return '';
    const diff = Date.now() - new Date(d + (String(d).endsWith('Z') ? '' : 'Z')).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'recien';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const notifRows = notifications.length === 0
    ? '<div class="text-center text-slate-400 py-8 text-sm">Sin notificaciones</div>'
    : notifications.map(n => {
      const icon = typeIcon[n.type] || '📌';
      const link = n.phone ? `/admin/client/${encodeURIComponent(n.phone)}` : '#';
      return `
        <div class="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0 group hover:bg-slate-50/50">
          <span class="text-sm mt-0.5">${icon}</span>
          <a href="${link}" class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-slate-700">${escapeHtml(n.title)}</span>
              <span class="text-[10px] text-slate-300">${_timeAgo(n.created_at)}</span>
            </div>
            ${n.body ? `<div class="text-[11px] text-slate-400 mt-0.5 truncate">${escapeHtml(n.body)}</div>` : ''}
          </a>
          <form method="POST" action="/admin/control/delete-notif/${encodeURIComponent(n.id)}" class="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button class="text-slate-300 hover:text-red-400 transition-colors p-1" title="Eliminar">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </form>
        </div>`;
    }).join('');

  // ── Status bar cards ──
  const statCard = (label, value, color, icon) =>
    `<div class="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
      <div class="w-9 h-9 rounded-lg bg-${color}-50 flex items-center justify-center text-base flex-shrink-0">${icon}</div>
      <div><div class="text-lg font-bold text-slate-800">${value}</div><div class="text-[10px] text-slate-400 uppercase tracking-wide">${label}</div></div>
    </div>`;

  // ── Active conversations ──
  const activeConvos = activeClients
    .filter(c => ['greeting','gathering','confirming','done','awaiting_feedback','awaiting_slot'].includes(c.stage))
    .sort((a,b) => new Date(b.updated_at+'Z') - new Date(a.updated_at+'Z'))
    .slice(0, 10);

  // Load full history only for active convos (max 10)
  const activeConvosWithHistory = await Promise.all(
    activeConvos.map(async c => {
      const full = await db.getConversation(c.phone);
      return { ...c, history: full?.history || [] };
    })
  );

  const stageLabel = { greeting: 'Saludando', gathering: 'Conversando', confirming: 'Confirmando', done: 'Procesando', awaiting_feedback: 'Esperando feedback', awaiting_slot: 'Eligiendo horario' };
  const stageColor = { greeting: 'slate', gathering: 'blue', confirming: 'amber', done: 'indigo', awaiting_feedback: 'purple', awaiting_slot: 'green' };

  const activeConvoRows = activeConvosWithHistory.length === 0
    ? '<div class="text-center text-slate-400 py-6 text-sm">No hay conversaciones activas</div>'
    : activeConvosWithHistory.map(c => {
      const nombre = c.report?.cliente?.nombre || phoneSlug(c.phone);
      const ph = encodeURIComponent(c.phone);
      const st = stageLabel[c.stage] || c.stage;
      const sc = stageColor[c.stage] || 'slate';
      const lastMsg = c.history?.length ? c.history[c.history.length-1] : null;
      const preview = lastMsg ? escapeHtml((lastMsg.content||'').substring(0,60)) + (lastMsg.content?.length > 60 ? '...' : '') : '';
      const msgRole = lastMsg?.role === 'user' ? '\u{1F464}' : '\u{1F916}';
      return `
      <a href="/admin/client/${ph}" class="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-slate-800">${escapeHtml(nombre)}</span>
            <span class="px-1.5 py-0.5 bg-${sc}-100 text-${sc}-600 text-[10px] font-medium rounded-full">${st}</span>
            <span class="text-[10px] text-slate-300">${_timeAgo(c.updated_at)}</span>
          </div>
          ${preview ? `<div class="text-[11px] text-slate-400 mt-0.5 truncate">${msgRole} ${preview}</div>` : ''}
        </div>
        <svg class="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
      </a>`;
    }).join('');

  // ── Upcoming meetings rows ──
  const meetingRows = upcomingMeetings.length === 0
    ? '<div class="px-4 py-6 text-center text-sm text-slate-400">No hay reuniones próximas</div>'
    : upcomingMeetings.map(m => {
      const dt = formatDate(m.start);
      const clientName = (m.summary || '').replace(/Reunión con /i, '').replace(/ — DT Systems/i, '');
      const meetBtn = m.meetLink
        ? `<a href="${escapeHtml(m.meetLink)}" target="_blank" class="text-[10px] px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium">Meet</a>`
        : '';
      return `<div class="px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
        <div class="flex items-center justify-between">
          <div class="min-w-0">
            <div class="text-sm font-medium text-slate-800">${escapeHtml(clientName)}</div>
            <div class="text-[11px] text-slate-500 mt-0.5 capitalize">${dt.full}</div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            ${meetBtn}
            <a href="${escapeHtml(m.htmlLink)}" target="_blank" class="text-[10px] px-2 py-1 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors">Ver</a>
          </div>
        </div>
      </div>`;
    }).join('');

  // ── My tasks widget ──
  const allProjectsForTasks = await db.listProjects();
  const myTasks = allProjectsForTasks
    .flatMap(p => (p.tasks || [])
      .map((t, i) => ({ ...t, idx: i, project: p }))
      .filter(t => !t.done && (t.assignee === 'david' || !t.assignee))
    )
    .sort((a, b) => {
      const prio = { high: 0, medium: 1, low: 2 };
      const pa = prio[a.priority] ?? 1;
      const pb = prio[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    })
    .slice(0, 8);

  const myTaskPriorityDot = p => {
    if (p === 'high') return '<span class="w-2 h-2 rounded-full bg-red-400 flex-shrink-0"></span>';
    if (p === 'medium') return '<span class="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></span>';
    return '<span class="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0"></span>';
  };

  const myTaskRows = myTasks.length === 0
    ? '<div class="px-4 py-6 text-center text-sm text-slate-400">Sin tareas pendientes</div>'
    : myTasks.map(t => {
      const dueBadge = t.due_date ? (() => {
        const d = new Date(t.due_date);
        const dl = Math.ceil((d - new Date()) / 86400000);
        const color = dl < 0 ? 'text-red-500' : dl <= 2 ? 'text-orange-500' : 'text-slate-400';
        const label = dl < 0 ? 'Vencida' : dl === 0 ? 'Hoy' : dl + 'd';
        return `<span class="text-[10px] ${color} font-medium">${label}</span>`;
      })() : '';
      return `
      <div class="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
        <button onclick="completeControlTask('${t.project.id}',${t.idx},this)" class="w-4 h-4 rounded border-2 border-slate-300 hover:border-blue-500 flex-shrink-0 transition-colors flex items-center justify-center cursor-pointer" title="Completar"></button>
        ${myTaskPriorityDot(t.priority)}
        <div class="flex-1 min-w-0">
          <div class="text-sm text-slate-700 truncate">${escapeHtml(t.text)}</div>
          <div class="flex items-center gap-2 mt-0.5">
            <a href="/admin/projects/${t.project.id}" class="text-[10px] text-blue-500 hover:underline truncate">${escapeHtml(t.project.title || t.project.client_name)}</a>
            ${dueBadge}
          </div>
        </div>
      </div>`;
    }).join('');

  // ── Enhanced meetings ──
  const nextMeeting = upcomingMeetings[0];
  const meetingCountdown = nextMeeting ? (() => {
    const now = new Date();
    const start = new Date(nextMeeting.start);
    const diffMs = start - now;
    const diffH = Math.floor(diffMs / 3600000);
    const diffM = Math.floor((diffMs % 3600000) / 60000);
    if (diffMs < 0) return 'Ahora';
    if (diffH < 1) return `en ${diffM}min`;
    if (diffH < 24) return `en ${diffH}h ${diffM}m`;
    const diffD = Math.ceil(diffMs / 86400000);
    return `en ${diffD} dia${diffD > 1 ? 's' : ''}`;
  })() : '';
  const isToday = nextMeeting ? new Date(nextMeeting.start).toDateString() === new Date().toDateString() : false;

  const body = `
    <div class="mb-5">
      <h1 class="text-xl font-bold text-slate-900">Centro de Control</h1>
      <p class="text-xs text-slate-400 mt-1">Estado del agente y acciones pendientes</p>
    </div>

    <!-- Status bar -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
      ${statCard('En conversacion', stats.gathering, 'blue', '💬')}
      ${statCard('Demos pendientes', stats.pendingReview, 'orange', '👁')}
      ${statCard('Esperando cliente', stats.awaitingFeedback, 'purple', '⏳')}
      ${statCard('Reuniones', stats.meetings, 'green', '📅')}
      ${statCard('Ganados', stats.won, 'emerald', '🏆')}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <!-- Columna izquierda -->
      <div class="lg:col-span-3">
        <!-- Acciones pendientes -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 class="text-sm font-semibold text-slate-700">Acciones pendientes</h2>
            ${actionItems.length > 0 ? `<span class="px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-bold rounded-full">${actionItems.length}</span>` : ''}
          </div>
          ${actionRows}
        </div>

        <!-- Conversaciones activas -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden mt-5">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 class="text-sm font-semibold text-slate-700">Conversaciones activas</h2>
            <span class="text-[10px] text-slate-400">${stats.gathering} activas</span>
          </div>
          ${activeConvoRows}
        </div>

        <!-- Pipeline rapido -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden mt-5">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 class="text-sm font-semibold text-slate-700">Pipeline rapido</h2>
            <a href="/admin/clients" class="text-xs text-blue-500 hover:underline">Ver todo</a>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
            <a href="/admin/clients?stage=all&view=kanban" class="px-4 py-3 text-center hover:bg-slate-50 transition-colors">
              <div class="text-2xl font-bold text-blue-600">${stats.gathering}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">Conversando</div>
            </a>
            <a href="/admin/clients?stage=all&view=kanban" class="px-4 py-3 text-center hover:bg-slate-50 transition-colors">
              <div class="text-2xl font-bold text-amber-500">${stats.done + stats.generating}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">Procesando</div>
            </a>
            <a href="/admin/clients?stage=negotiating&view=kanban" class="px-4 py-3 text-center hover:bg-slate-50 transition-colors">
              <div class="text-2xl font-bold text-purple-600">${stats.awaitingFeedback + stats.awaitingSlot}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">Negociando</div>
            </a>
            <a href="/admin/clients?stage=won" class="px-4 py-3 text-center hover:bg-slate-50 transition-colors">
              <div class="text-2xl font-bold text-emerald-600">${stats.won}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">Cerrados</div>
            </a>
          </div>
        </div>
      </div>

      <!-- Columna derecha -->
      <div class="lg:col-span-2">
        <!-- Proximas reuniones (PROMINENTE) -->
        <div class="bg-white rounded-xl border ${isToday ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'} overflow-hidden mb-5">
          <div class="flex items-center justify-between px-4 py-3 border-b ${isToday ? 'border-blue-100 bg-blue-50/50' : 'border-slate-100'}">
            <h2 class="text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-slate-700'}">📅 Proximas reuniones</h2>
            <span class="text-[10px] ${isToday ? 'text-blue-500' : 'text-slate-400'}">${upcomingMeetings.length} agendadas</span>
          </div>
          ${nextMeeting ? `
          <div class="px-4 py-3 ${isToday ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : 'bg-slate-50/50'} border-b border-slate-100">
            <div class="flex items-center justify-between">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold ${isToday ? 'text-blue-800' : 'text-slate-800'}">${escapeHtml((nextMeeting.summary || '').replace(/Reunion con /i, '').replace(/ — DT Systems/i, ''))}</div>
                <div class="text-xs ${isToday ? 'text-blue-600' : 'text-slate-500'} mt-0.5 capitalize">${formatDate(nextMeeting.start).full}</div>
                <div class="text-[10px] font-bold ${isToday ? 'text-blue-500' : 'text-indigo-500'} mt-1 uppercase tracking-wide">${meetingCountdown}</div>
              </div>
              <div class="flex flex-col gap-1.5 flex-shrink-0 ml-3">
                ${nextMeeting.meetLink ? `<a href="${escapeHtml(nextMeeting.meetLink)}" target="_blank" class="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-center">Google Meet</a>` : ''}
                <a href="${escapeHtml(nextMeeting.htmlLink)}" target="_blank" class="text-[10px] px-3 py-1 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors text-center">Ver en Calendar</a>
              </div>
            </div>
          </div>` : ''}
          ${upcomingMeetings.slice(1).length > 0 ? upcomingMeetings.slice(1).map(m => {
            const dt = formatDate(m.start);
            const clientName = (m.summary || '').replace(/Reunion con /i, '').replace(/ — DT Systems/i, '');
            const meetBtn = m.meetLink ? `<a href="${escapeHtml(m.meetLink)}" target="_blank" class="text-[10px] px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium">Meet</a>` : '';
            return `<div class="px-4 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
              <div class="flex items-center justify-between">
                <div class="min-w-0">
                  <div class="text-sm text-slate-700">${escapeHtml(clientName)}</div>
                  <div class="text-[10px] text-slate-400 mt-0.5 capitalize">${dt.full}</div>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">${meetBtn}</div>
              </div>
            </div>`;
          }).join('') : ''}
          ${upcomingMeetings.length === 0 ? '<div class="px-4 py-6 text-center text-sm text-slate-400">No hay reuniones proximas</div>' : ''}
        </div>

        <!-- Mis tareas (NUEVO) -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 class="text-sm font-semibold text-slate-700">Mis tareas</h2>
            <a href="/admin/tasks?view=kanban" class="text-xs text-blue-500 hover:underline">Ver todas</a>
          </div>
          ${myTaskRows}
        </div>

        <!-- Actividad -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 class="text-sm font-semibold text-slate-700">Actividad</h2>
            <div class="flex items-center gap-2">
              <a href="/admin/control" class="text-slate-400 hover:text-slate-600 transition-colors p-1" title="Refrescar">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              </a>
              ${notifications.length > 0 ? `
              <form method="POST" action="/admin/control/clear-read" class="inline">
                <button class="text-slate-400 hover:text-slate-600 transition-colors p-1" title="Limpiar leidas">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                </button>
              </form>
              <form method="POST" action="/admin/control/clear-all" class="inline" onsubmit="return confirm('Borrar todas las notificaciones?')">
                <button class="text-slate-400 hover:text-red-400 transition-colors p-1" title="Borrar todas">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </form>` : ''}
            </div>
          </div>
          <div class="max-h-[400px] overflow-y-auto">
            ${notifRows}
          </div>
        </div>

        <!-- Sistema -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden mt-5">
          <div class="px-4 py-3 border-b border-slate-100">
            <h2 class="text-sm font-semibold text-slate-700">Sistema</h2>
          </div>
          <div class="px-4 py-3 space-y-2 text-xs">
            <div class="flex justify-between"><span class="text-slate-400">Total contactos</span><span class="font-medium text-slate-700">${stats.total}</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Generando demos</span><span class="font-medium text-amber-600">${stats.generating}</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Perdidos</span><span class="font-medium text-red-500">${stats.lost}</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Archivados</span><span class="font-medium text-slate-500">${allClients.filter(c=>c.archived).length}</span></div>
            <div class="border-t border-slate-100 pt-2 mt-2">
              <div class="flex justify-between"><span class="text-slate-400">Tasa de conversion</span><span class="font-bold text-emerald-600">${stats.total > 0 ? Math.round(stats.won / stats.total * 100) : 0}%</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <script>
      setTimeout(function(){ location.reload(); }, 30000);
      function completeControlTask(projectId, taskIdx, btn) {
        btn.innerHTML = '<svg class="w-3 h-3 spin text-blue-500" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 2a10 10 0 010 20 10 10 0 010-20" stroke-dasharray="60" stroke-dashoffset="20"/></svg>';
        fetch('/admin/api/task-move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: projectId, taskIdx: taskIdx, newStatus: 'done' })
        }).then(function(r) { return r.json(); }).then(function(d) {
          if (d.ok) {
            showToast('Tarea completada');
            var row = btn.closest('.flex.items-center');
            if (row) { row.style.opacity = '0.3'; row.style.textDecoration = 'line-through'; }
            setTimeout(function() { if (row) row.remove(); }, 800);
          } else {
            showToast('Error', 'error');
          }
        }).catch(function() { showToast('Error de red', 'error'); });
      }
    </script>`;

  res.send(layout('Centro de Control', body, { pendingCount, activePage: 'control', user: req.session?.user }));
});

// ── Control center actions ──
router.post('/control/delete-notif/:id', requireAuth, async (req, res) => {
  await db.deleteNotification(req.params.id);
  res.redirect('/admin/control');
});

router.post('/control/clear-read', requireAuth, async (req, res) => {
  await db.deleteReadNotifications();
  res.redirect('/admin/control');
});

router.post('/control/clear-all', requireAuth, async (req, res) => {
  await db.deleteAllNotifications();
  res.redirect('/admin/control');
});

// API: contador de notificaciones sin leer (para el badge)
router.get('/api/notif-count', requireAuth, async (req, res) => {
  const count = await db.getUnreadNotificationCount();
  res.json({ count });
});

// API: conversation data for live refresh
router.get('/api/conversation/:phone', requireAuth, async (req, res) => {
  const conv = await db.getConversation(req.params.phone);
  if (!conv) return res.json({ history: [], stage: '', messageCount: 0 });
  res.json({
    history: conv.history || [],
    stage: conv.stage,
    client_stage: conv.client_stage,
    demo_status: conv.demo_status,
    messageCount: (conv.history || []).length,
    updated_at: conv.updated_at,
  });
});

// API: transcribe audio for corrections (voice input)
const uploadAudio = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

router.post('/api/transcribe', requireAuth, uploadAudio.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.json({ error: 'No audio file', text: '' });

    const Groq = require('groq-sdk');
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.json({ error: 'GROQ_API_KEY not set', text: '' });

    const client = new Groq({ apiKey });
    const tmpPath = path.join(require('os').tmpdir(), `admin_audio_${Date.now()}.webm`);
    fs.writeFileSync(tmpPath, req.file.buffer);

    try {
      const result = await client.audio.transcriptions.create({
        file: fs.createReadStream(tmpPath),
        model: 'whisper-large-v3',
        language: 'es',
      });
      res.json({ text: (result.text || '').trim() });
    } finally {
      fs.unlink(tmpPath, () => {});
    }
  } catch (err) {
    console.error('[transcribe-api] Error:', err.message);
    res.json({ error: err.message, text: '' });
  }
});

// ─── All tasks ───────────────────────────────────────────────────────────────

router.get('/tasks', requireAuth, async (req, res) => {
  const projects = await db.listProjects();
  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;

  const filter = req.query.filter || 'all'; // all | high | overdue | today
  const view = req.query.view || 'kanban'; // list | kanban

  // Clientes primero por defecto — personal/diseño van al fondo
  const CAT_PRIORITY = { cliente: 0, ventas: 1, desarrollo: 2, diseño: 3, personal: 4, otro: 5 };

  // Gather all pending tasks with project context, clientes first
  let taskGroups = projects
    .sort((a, b) => (CAT_PRIORITY[a.category] ?? 99) - (CAT_PRIORITY[b.category] ?? 99))
    .map(p => ({
      project: p,
      tasks: (p.tasks || []).filter(t => !t.done),
    }))
    .filter(g => g.tasks.length > 0);

  if (filter === 'high') taskGroups = taskGroups.map(g => ({ ...g, tasks: g.tasks.filter(t => t.priority === 'high') })).filter(g => g.tasks.length > 0);
  if (filter === 'overdue') taskGroups = taskGroups.map(g => ({ ...g, tasks: g.tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()) })).filter(g => g.tasks.length > 0);
  if (filter === 'today') taskGroups = taskGroups.map(g => ({ ...g, tasks: g.tasks.filter(t => { if (!t.due_date) return false; const dl = Math.ceil((new Date(t.due_date) - new Date()) / 86400000); return dl >= 0 && dl <= 1; }) })).filter(g => g.tasks.length > 0);
  if (filter === 'david') taskGroups = taskGroups.map(g => ({ ...g, tasks: g.tasks.filter(t => t.assignee === 'david') })).filter(g => g.tasks.length > 0);
  if (filter === 'hermana') taskGroups = taskGroups.map(g => ({ ...g, tasks: g.tasks.filter(t => t.assignee === 'hermana') })).filter(g => g.tasks.length > 0);

  const totalPending = projects.reduce((n, p) => n + (p.tasks || []).filter(t => !t.done).length, 0);
  const inProgressCount = projects.reduce((n, p) => n + (p.tasks || []).filter(t => !t.done && t.status === 'in_progress').length, 0);
  const doneCount = projects.reduce((n, p) => n + (p.tasks || []).filter(t => t.done).length, 0);
  const highPriority = projects.reduce((n, p) => n + (p.tasks || []).filter(t => !t.done && t.priority === 'high').length, 0);
  const overdueCount = projects.reduce((n, p) => n + (p.tasks || []).filter(t => !t.done && t.due_date && new Date(t.due_date) < new Date()).length, 0);
  const todayCount = projects.reduce((n, p) => n + (p.tasks || []).filter(t => {
    if (t.done || !t.due_date) return false;
    const dl = Math.ceil((new Date(t.due_date) - new Date()) / 86400000);
    return dl >= 0 && dl <= 1;
  }).length, 0);

  const filterTabs = [
    { key: 'all', label: `Todas (${totalPending})` },
    { key: 'high', label: `Alta prioridad (${highPriority})` },
    overdueCount > 0 ? { key: 'overdue', label: `Vencidas (${overdueCount})` } : null,
    todayCount > 0 ? { key: 'today', label: `Hoy (${todayCount})` } : null,
    { key: 'david', label: 'David' },
    { key: 'hermana', label: 'Hermana' },
  ].filter(Boolean).map(t => `<a href="/admin/tasks?filter=${t.key}&view=${view}" class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === t.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}">${t.label}</a>`).join('');

  const priorityDot = p => {
    if (p === 'high') return '<span class="w-2 h-2 rounded-full bg-red-400 flex-shrink-0 mt-1"></span>';
    if (p === 'medium') return '<span class="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1"></span>';
    return '<span class="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0 mt-1"></span>';
  };

  const priorityDotKanban = p => {
    if (p === 'high') return '<span class="w-2 h-2 rounded-full bg-red-400 flex-shrink-0"></span>';
    if (p === 'medium') return '<span class="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></span>';
    return '<span class="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0"></span>';
  };

  // ── View toggle ──
  const viewToggle = `
    <div class="view-toggle flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
      <a href="/admin/tasks?filter=${filter}&view=list" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
        Lista
      </a>
      <a href="/admin/tasks?filter=${filter}&view=kanban" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'kanban' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/></svg>
        Kanban
      </a>
    </div>`;

  // ── List view (existing) ──
  const groups = taskGroups.map(g => `
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4">
      <div class="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-slate-800">${escapeHtml(g.project.title || g.project.client_name)}</span>
            ${categoryBadge(g.project.category || 'cliente')}
            ${g.project.deadline ? (() => {
              const d = new Date(g.project.deadline);
              const dl = Math.ceil((d - new Date()) / 86400000);
              return `<span class="text-[10px] ${dl < 0 ? 'bg-red-100 text-red-600' : dl <= 3 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'} px-2 py-0.5 rounded-full font-medium">${dl < 0 ? 'Vencida' : dl === 0 ? 'Hoy' : `${dl}d`}</span>`;
            })() : ''}
          </div>
          ${g.project.client_name && g.project.title ? `<div class="text-xs text-slate-400">${escapeHtml(g.project.client_name)}</div>` : ''}
        </div>
        <a href="/admin/projects/${g.project.id}" class="text-xs text-blue-600 hover:underline flex-shrink-0">Ver proyecto</a>
      </div>
      <div class="divide-y divide-slate-100">
        ${g.tasks.map((t, i) => `
          <form method="POST" action="/admin/projects/${g.project.id}/task-toggle" class="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
            <input type="hidden" name="idx" value="${(g.project.tasks || []).findIndex(pt => pt.text === t.text && !pt.done)}">
            <input type="checkbox" name="done" onchange="this.form.submit()" class="mt-0.5 w-4 h-4 rounded flex-shrink-0 accent-blue-600 cursor-pointer">
            <div class="flex items-start gap-2 flex-1 min-w-0">
              ${priorityDot(t.priority)}
              <div class="flex-1 min-w-0">
                <div class="text-sm text-slate-700">${escapeHtml(t.text)}</div>
                <div class="flex items-center gap-1 mt-0.5">
                  ${t.assignee ? `<span class="text-xs text-slate-400">${escapeHtml(t.assignee)}</span>` : ''}
                  ${t.due_date ? (() => {
                    const d = new Date(t.due_date);
                    const dl = Math.ceil((d - new Date()) / 86400000);
                    const color = dl < 0 ? 'text-red-500' : dl <= 2 ? 'text-orange-500' : 'text-slate-400';
                    const label = dl < 0 ? `Vencida` : dl === 0 ? 'Hoy' : `${dl}d`;
                    return `<span class="text-[10px] ${color} font-medium ml-1">${label}</span>`;
                  })() : ''}
                </div>
              </div>
            </div>
          </form>`).join('')}
      </div>
    </div>`).join('');

  // ── Kanban view ──
  // Gather ALL tasks (including done) for kanban, with their project index
  const allTasksFlat = projects
    .sort((a, b) => (CAT_PRIORITY[a.category] ?? 99) - (CAT_PRIORITY[b.category] ?? 99))
    .flatMap(p => (p.tasks || []).map((t, idx) => ({ ...t, projectId: p.id, projectTitle: p.title || p.client_name, projectCategory: p.category || 'cliente', taskIdx: idx })));

  const todoTasks = allTasksFlat.filter(t => taskStatus(t) === 'todo');
  const ipTasks = allTasksFlat.filter(t => taskStatus(t) === 'in_progress');
  const doneTasks = allTasksFlat.filter(t => taskStatus(t) === 'done').slice(0, 20); // Limit done to last 20

  const kanbanCard = (t) => {
    const dueBadge = t.due_date ? (() => {
      const d = new Date(t.due_date);
      const dl = Math.ceil((d - new Date()) / 86400000);
      const color = dl < 0 ? 'bg-red-100 text-red-600' : dl <= 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500';
      const label = dl < 0 ? 'Vencida' : dl === 0 ? 'Hoy' : `${dl}d`;
      return `<span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium ${color}">${label}</span>`;
    })() : '';
    const assigneeBadge = t.assignee ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">${escapeHtml(t.assignee)}</span>` : '';
    const cat = PROJECT_CATEGORIES.find(c => c.key === t.projectCategory) || PROJECT_CATEGORIES[0];
    return `
      <div class="kanban-card bg-white rounded-xl border border-slate-200 p-3 mb-2 cursor-grab active:cursor-grabbing"
           data-project-id="${t.projectId}" data-task-idx="${t.taskIdx}">
        <div class="flex items-start gap-2">
          ${priorityDotKanban(t.priority)}
          <div class="flex-1 min-w-0">
            <div class="text-sm text-slate-700 leading-snug ${t.done ? 'line-through text-slate-400' : ''}">${escapeHtml(t.text)}</div>
            <div class="flex items-center gap-1.5 mt-2 flex-wrap">
              <a href="/admin/projects/${t.projectId}" onclick="event.stopPropagation()" class="text-[10px] px-1.5 py-0.5 rounded-full font-medium hover:opacity-80 transition-opacity" style="background:${cat.color}15;color:${cat.color}">${escapeHtml(t.projectTitle)}</a>
              ${assigneeBadge}
              ${dueBadge}
            </div>
          </div>
        </div>
      </div>`;
  };

  const kanbanColumn = (status, label, color, tasks) => `
    <div class="flex-1 min-w-[280px] max-w-[400px]">
      <div class="flex items-center gap-2 mb-3 px-1">
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${color}"></span>
        <span class="text-sm font-semibold text-slate-700">${label}</span>
        <span class="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">${tasks.length}</span>
      </div>
      <div class="kanban-col bg-slate-50/80 rounded-2xl border-2 border-dashed border-slate-200 p-2" data-status="${status}" style="min-height:200px">
        ${tasks.length > 0 ? tasks.map(t => kanbanCard(t)).join('') : '<div class="kanban-empty">Arrastra tareas aqu&iacute;</div>'}
      </div>
    </div>`;

  const kanbanView = `
    <div class="flex gap-4 overflow-x-auto pb-4" style="min-height:400px">
      ${kanbanColumn('todo', 'Pendientes', '#94a3b8', todoTasks)}
      ${kanbanColumn('in_progress', 'En progreso', '#3b82f6', ipTasks)}
      ${kanbanColumn('done', 'Completadas', '#10b981', doneTasks)}
    </div>
    <script>
    document.querySelectorAll('.kanban-col[data-status]').forEach(function(col) {
      new Sortable(col, {
        group: 'tasks',
        animation: 200,
        ghostClass: 'kanban-ghost',
        dragClass: 'kanban-drag',
        onEnd: function(evt) {
          var card = evt.item;
          var newStatus = evt.to.dataset.status;
          fetch('/admin/api/task-move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: card.dataset.projectId,
              taskIdx: parseInt(card.dataset.taskIdx),
              newStatus: newStatus
            })
          }).then(function(r) { return r.json(); }).then(function(d) {
            if (d.ok) {
              showToast('Tarea movida');
              // Update empty state
              document.querySelectorAll('.kanban-col').forEach(function(c) {
                var empty = c.querySelector('.kanban-empty');
                if (c.querySelectorAll('.kanban-card').length === 0 && !empty) {
                  c.innerHTML = '<div class="kanban-empty">Arrastra tareas aqu\\u00ed</div>';
                } else if (empty && c.querySelectorAll('.kanban-card').length > 0) {
                  empty.remove();
                }
              });
              // Update counters
              document.querySelectorAll('.kanban-col').forEach(function(c) {
                var count = c.querySelectorAll('.kanban-card').length;
                var header = c.closest('.min-w-\\\\[280px\\\\]') || c.parentElement;
                var badge = header.querySelector('.text-xs.text-slate-400');
                if (badge) badge.textContent = count;
              });
            } else {
              showToast('Error: ' + (d.error || ''), 'error');
              setTimeout(function() { location.reload(); }, 1500);
            }
          }).catch(function() {
            showToast('Error de red', 'error');
            setTimeout(function() { location.reload(); }, 1500);
          });
        }
      });
    });
    </script>`;

  const body = `
    <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
      <div class="flex-1">
        <h1 class="text-xl md:text-2xl font-bold text-slate-900">Tareas</h1>
        <div class="text-sm text-slate-400 mt-0.5">${totalPending} pendiente${totalPending !== 1 ? 's' : ''} · ${inProgressCount} en progreso · ${doneCount} completada${doneCount !== 1 ? 's' : ''}</div>
      </div>
      ${viewToggle}
    </div>
    <div class="flex items-center gap-1.5 mb-5 flex-wrap">${filterTabs}</div>
    ${view === 'kanban' ? kanbanView : (taskGroups.length > 0 ? groups : `
      <div class="text-center py-20">
        <div class="text-5xl mb-4">✅</div>
        <h3 class="text-lg font-semibold text-slate-700 mb-2">Todo al dia</h3>
        <p class="text-sm text-slate-400">No hay tareas pendientes${filter !== 'all' ? ' con este filtro' : ''}.</p>
      </div>`)}`;

  res.send(layout('Tareas', body, { pendingCount, activePage: 'tasks', user: req.session?.user }));
});

// ─── Projects list ───────────────────────────────────────────────────────────

router.get('/projects', requireAuth, async (req, res) => {
  const filter = req.query.status || 'all';
  const search = (req.query.q || '').toLowerCase();
  const sort = req.query.sort || 'clientes'; // clientes | recientes | deadline | status
  const view = req.query.view || 'cards'; // cards | kanban
  let projects = await db.listProjects();
  const allProjects = projects;
  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;

  if (search) projects = projects.filter(p =>
    p.client_name.toLowerCase().includes(search) || p.title.toLowerCase().includes(search) || p.type.toLowerCase().includes(search));
  if (filter.startsWith('cat_')) {
    const catKey = filter.slice(4);
    projects = projects.filter(p => (p.category || 'cliente') === catKey);
  } else if (filter !== 'all') {
    projects = projects.filter(p => p.status === filter);
  }

  // Ordenamiento
  const CAT_ORDER = { cliente: 0, ventas: 1, desarrollo: 2, diseño: 3, personal: 4, otro: 5 };
  const STATUS_ORDER = { in_progress: 0, review: 1, waiting_client: 2, waiting_payment: 3, planning: 4, delivered: 5, paused: 6, cancelled: 7 };
  if (sort === 'clientes') {
    projects.sort((a, b) => {
      const ca = CAT_ORDER[a.category] ?? 99;
      const cb = CAT_ORDER[b.category] ?? 99;
      if (ca !== cb) return ca - cb;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
  } else if (sort === 'recientes') {
    projects.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  } else if (sort === 'deadline') {
    const withDl = projects.filter(p => p.deadline).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    const noDl = projects.filter(p => !p.deadline).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    projects = [...withDl, ...noDl];
  } else if (sort === 'status') {
    projects.sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));
  }

  const tabs = [
    { key: 'all', label: 'Todos', count: allProjects.length },
    ...PROJECT_CATEGORIES.map(c => ({ key: `cat_${c.key}`, label: `${c.dot} ${c.label}`, count: allProjects.filter(p => (p.category || 'cliente') === c.key).length })),
    ...PROJECT_STATUS.map(s => ({ key: s.key, label: s.label, count: allProjects.filter(p => p.status === s.key).length }))
  ].filter(t => t.key === 'all' || t.count > 0);

  const tabHtml = tabs.map(t => `
    <a href="/admin/projects?status=${t.key}${search ? '&q=' + encodeURIComponent(search) : ''}&view=${view}"
      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === t.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}">
      ${t.label} <span class="text-xs ${filter === t.key ? 'opacity-70' : 'text-slate-400'}">${t.count}</span>
    </a>`).join('');

  // ── View toggle ──
  const viewToggle = `
    <div class="view-toggle flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
      <a href="/admin/projects?status=${filter}${search ? '&q=' + encodeURIComponent(search) : ''}&sort=${sort}&view=cards" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'cards' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        Cards
      </a>
      <a href="/admin/projects?status=${filter}${search ? '&q=' + encodeURIComponent(search) : ''}&sort=${sort}&view=kanban" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'kanban' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/></svg>
        Kanban
      </a>
    </div>`;

  const cards = projects.map(p => {
    const tasks = p.tasks || [];
    const doneTasks = tasks.filter(t => t.done).length;
    const pendingTasks = tasks.filter(t => !t.done);
    const pct = tasks.length > 0 ? Math.round(doneTasks / tasks.length * 100) : 0;
    const cat = PROJECT_CATEGORIES.find(c => c.key === (p.category || 'cliente')) || PROJECT_CATEGORIES[0];
    const statusObj = PROJECT_STATUS.find(s => s.key === p.status) || PROJECT_STATUS[0];
    return `
    <div class="bg-white rounded-2xl border border-slate-200 hover:shadow-md transition-all cursor-pointer group overflow-hidden"
         onclick="location.href='/admin/projects/${p.id}'"
         style="border-top: 3px solid ${cat.color}">
      <div class="p-5">
        <div class="flex items-start justify-between mb-2">
          <div class="flex-1 min-w-0 pr-3">
            <div class="font-semibold text-slate-800 truncate text-base">${escapeHtml(p.title || p.client_name)}</div>
            <div class="text-xs text-slate-400 mt-0.5 truncate">${escapeHtml(p.client_name)}${p.client_email ? ` · ${escapeHtml(p.client_email)}` : ''}</div>
          </div>
          <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
            ${projectStatusBadge(p.status)}
            ${budgetStatusBadge(p.budget_status)}
          </div>
        </div>
        <div class="flex items-center gap-2 mb-3">
          <span class="text-[10px] px-2 py-0.5 rounded-full font-medium ${cat.badge}">${cat.dot} ${cat.label}</span>
          ${p.deadline ? (() => {
            const d = new Date(p.deadline);
            const dl = Math.ceil((d - new Date()) / 86400000);
            const color = dl < 0 ? 'bg-red-100 text-red-600' : dl <= 3 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500';
            return `<span class="text-[10px] px-2 py-0.5 rounded-full font-medium ${color}">${dl < 0 ? 'Vencida' : dl === 0 ? 'Hoy' : `${dl}d`}</span>`;
          })() : ''}
        </div>
        ${p.description ? `<p class="text-xs text-slate-500 mb-3 line-clamp-2">${escapeHtml(p.description)}</p>` : ''}
        ${pendingTasks.length > 0 ? `
          <div class="mb-3 space-y-1">
            ${pendingTasks.slice(0, 2).map(t => `
              <div class="flex items-start gap-2 text-xs text-slate-600">
                <span class="${t.priority === 'high' ? 'text-red-400' : 'text-orange-300'} mt-0.5 flex-shrink-0">●</span>
                <span class="truncate">${escapeHtml(t.text)}</span>
              </div>`).join('')}
            ${pendingTasks.length > 2 ? `<div class="text-xs text-slate-400">+${pendingTasks.length - 2} mas</div>` : ''}
          </div>` : ''}
        ${tasks.length > 0 ? `
          <div class="flex items-center gap-2 mt-3">
            <div class="flex-1 bg-slate-100 rounded-full h-1.5">
              <div class="h-1.5 rounded-full transition-all" style="width:${pct}%;background:${cat.color}"></div>
            </div>
            <span class="text-xs text-slate-400 flex-shrink-0">${doneTasks}/${tasks.length}</span>
          </div>` : ''}
      </div>
      <div class="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
        <span class="text-xs text-slate-400">${timeAgo(p.updated_at)}</span>
        ${p.budget ? `<span class="text-xs font-semibold text-slate-700">${escapeHtml(p.budget)}</span>` : ''}
      </div>
    </div>`;
  }).join('');

  // ── Projects Kanban view ──
  const kanbanStatuses = PROJECT_STATUS.filter(s =>
    ['planning','in_progress','waiting_client','review','delivered'].includes(s.key) ||
    allProjects.some(p => p.status === s.key)
  );

  const projKanbanCard = (p) => {
    const tasks = p.tasks || [];
    const doneTasks = tasks.filter(t => t.done).length;
    const pct = tasks.length > 0 ? Math.round(doneTasks / tasks.length * 100) : 0;
    const cat = PROJECT_CATEGORIES.find(c => c.key === (p.category || 'cliente')) || PROJECT_CATEGORIES[0];
    const deadlineBadge = p.deadline ? (() => {
      const d = new Date(p.deadline);
      const dl = Math.ceil((d - new Date()) / 86400000);
      const color = dl < 0 ? 'bg-red-100 text-red-600' : dl <= 3 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500';
      return `<span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium ${color}">${dl < 0 ? 'Vencida' : dl === 0 ? 'Hoy' : dl + 'd'}</span>`;
    })() : '';
    return `
      <div class="kanban-card bg-white rounded-xl border border-slate-200 p-3.5 mb-2 cursor-grab active:cursor-grabbing"
           data-project-id="${p.id}" onclick="if(!window._dragging)location.href='/admin/projects/${p.id}'" style="border-left:3px solid ${cat.color}">
        <div class="font-medium text-sm text-slate-800 truncate mb-1">${escapeHtml(p.title || p.client_name)}</div>
        <div class="text-[11px] text-slate-400 truncate mb-2">${escapeHtml(p.client_name)}</div>
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style="background:${cat.color}15;color:${cat.color}">${cat.dot} ${cat.label}</span>
          ${deadlineBadge}
          ${p.budget ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">${escapeHtml(p.budget)}</span>` : ''}
        </div>
        ${tasks.length > 0 ? `
          <div class="flex items-center gap-2 mt-2.5">
            <div class="flex-1 bg-slate-100 rounded-full h-1">
              <div class="h-1 rounded-full" style="width:${pct}%;background:${cat.color}"></div>
            </div>
            <span class="text-[10px] text-slate-400">${doneTasks}/${tasks.length}</span>
          </div>` : ''}
      </div>`;
  };

  const projKanbanHtml = `
    <div class="flex gap-4 overflow-x-auto pb-4" style="min-height:400px">
      ${kanbanStatuses.map(s => {
        const colProjects = allProjects.filter(p => p.status === s.key);
        return `
        <div class="flex-shrink-0" style="width:280px">
          <div class="flex items-center gap-2 mb-3 px-1">
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${s.dot}"></span>
            <span class="text-sm font-semibold text-slate-700">${s.label}</span>
            <span class="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">${colProjects.length}</span>
          </div>
          <div class="kanban-col bg-slate-50/80 rounded-2xl border-2 border-dashed border-slate-200 p-2 proj-kanban-col" data-status="${s.key}" style="min-height:200px">
            ${colProjects.length > 0 ? colProjects.map(p => projKanbanCard(p)).join('') : '<div class="kanban-empty">Arrastra proyectos aqu&iacute;</div>'}
          </div>
        </div>`;
      }).join('')}
    </div>
    <script>
    window._dragging = false;
    document.querySelectorAll('.proj-kanban-col').forEach(function(col) {
      new Sortable(col, {
        group: 'projects',
        animation: 200,
        ghostClass: 'kanban-ghost',
        dragClass: 'kanban-drag',
        onStart: function() { window._dragging = true; },
        onEnd: function(evt) {
          setTimeout(function() { window._dragging = false; }, 100);
          var card = evt.item;
          var newStatus = evt.to.dataset.status;
          fetch('/admin/api/project-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: card.dataset.projectId, newStatus: newStatus })
          }).then(function(r) { return r.json(); }).then(function(d) {
            if (d.ok) {
              showToast('Proyecto movido');
              document.querySelectorAll('.proj-kanban-col').forEach(function(c) {
                var empty = c.querySelector('.kanban-empty');
                if (c.querySelectorAll('.kanban-card').length === 0 && !empty) {
                  c.innerHTML = '<div class="kanban-empty">Arrastra proyectos aqu\\u00ed</div>';
                } else if (empty && c.querySelectorAll('.kanban-card').length > 0) {
                  empty.remove();
                }
              });
            } else {
              showToast('Error: ' + (d.error || ''), 'error');
              setTimeout(function() { location.reload(); }, 1500);
            }
          }).catch(function() {
            showToast('Error de red', 'error');
            setTimeout(function() { location.reload(); }, 1500);
          });
        }
      });
    });
    </script>`;

  const emptyState = `
    <div class="text-center py-20">
      <div class="text-5xl mb-4">📋</div>
      <h3 class="text-lg font-semibold text-slate-700 mb-2">Sin proyectos todavia</h3>
      <p class="text-sm text-slate-400 mb-6">Crea tu primer proyecto o converti un lead de WhatsApp.</p>
      <a href="/admin/projects/new" class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">+ Nuevo proyecto</a>
    </div>`;

  const body = `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <h1 class="text-xl md:text-2xl font-bold text-slate-900">Proyectos</h1>
      <div class="flex items-center gap-3">
        ${viewToggle}
        <a href="/admin/projects/new" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">+ Nuevo proyecto</a>
      </div>
    </div>
    ${view === 'cards' ? `
    <div class="flex items-center gap-2 mb-4">
      <form method="GET" action="/admin/projects" class="flex-1 flex items-center gap-2">
        <input type="hidden" name="status" value="${escapeHtml(filter)}">
        <input type="hidden" name="sort" value="${escapeHtml(sort)}">
        <input type="hidden" name="view" value="${view}">
        <input type="text" name="q" value="${escapeHtml(search)}" placeholder="Buscar por cliente, titulo o tipo..."
          class="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      </form>
      <form method="GET" action="/admin/projects">
        <input type="hidden" name="status" value="${escapeHtml(filter)}">
        <input type="hidden" name="q" value="${escapeHtml(search)}">
        <input type="hidden" name="view" value="${view}">
        <select name="sort" onchange="this.form.submit()"
          class="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          <option value="clientes" ${sort==='clientes'?'selected':''}>Clientes primero</option>
          <option value="status"   ${sort==='status'?'selected':''}>Por estado</option>
          <option value="deadline" ${sort==='deadline'?'selected':''}>Por deadline</option>
          <option value="recientes"${sort==='recientes'?'selected':''}>Mas recientes</option>
        </select>
      </form>
    </div>
    <div class="flex items-center gap-3 mb-5 flex-wrap">
      ${[
        { label: 'Total', value: allProjects.length, color: 'text-slate-600', bg: 'bg-slate-100' },
        { label: 'Planificando', value: allProjects.filter(p => p.status === 'planning').length, color: 'text-amber-700', bg: 'bg-amber-50' },
        { label: 'En progreso', value: allProjects.filter(p => p.status === 'in_progress').length, color: 'text-blue-700', bg: 'bg-blue-50' },
        { label: 'En revision', value: allProjects.filter(p => p.status === 'review').length, color: 'text-purple-700', bg: 'bg-purple-50' },
        { label: 'Entregados', value: allProjects.filter(p => p.status === 'delivered').length, color: 'text-emerald-700', bg: 'bg-emerald-50' },
      ].filter(s => s.value > 0 || s.label === 'Total').map(s => `
        <div class="flex items-center gap-2 ${s.bg} px-3 py-1.5 rounded-full">
          <span class="text-xs font-bold ${s.color}">${s.value}</span>
          <span class="text-xs ${s.color} opacity-70">${s.label}</span>
        </div>`).join('')}
    </div>
    <div class="flex items-center gap-1.5 mb-5 flex-wrap">${tabHtml}</div>
    ${cards ? '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">' + cards + '</div>' : emptyState}` : projKanbanHtml}`;

  res.send(layout('Proyectos', body, { pendingCount, activePage: 'projects', user: req.session?.user }));
});

// ─── New project form ─────────────────────────────────────────────────────────

function projectForm(data = {}, action = '/admin/projects', btnLabel = 'Crear proyecto', clientList = []) {
  const statusOpts = PROJECT_STATUS.map(s =>
    `<option value="${s.key}" ${(data.status || 'planning') === s.key ? 'selected' : ''}>${s.label}</option>`).join('');
  const budgetOpts = BUDGET_STATUS.map(s =>
    `<option value="${s.key}" ${(data.budget_status || 'not_quoted') === s.key ? 'selected' : ''}>${s.label}</option>`).join('');

  const tasks = data.tasks || [];

  const clientOptions = clientList.map(cl =>
    `<option value="${cl.id}" ${(data.client_id || '') === cl.id ? 'selected' : ''}
     data-name="${escapeHtml(cl.name)}" data-phone="${escapeHtml(cl.phone)}" data-email="${escapeHtml(cl.email)}">
     ${escapeHtml(cl.name)}${cl.company ? ` (${escapeHtml(cl.company)})` : ''}
    </option>`
  ).join('');

  return `
    <form method="POST" action="${action}" id="projectForm">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2 space-y-5">

          <div class="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 class="text-sm font-semibold text-slate-700 mb-4">Datos del cliente</h2>
            <div class="mb-4 pb-4 border-b border-slate-100">
              <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Vincular a cliente existente</label>
              <select name="client_id" onchange="fillClientData(this)"
                class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Sin vincular o nuevo cliente —</option>
                ${clientOptions}
              </select>
              <div class="text-[10px] text-slate-400 mt-1">Seleccioná un cliente para pre-cargar sus datos</div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="sm:col-span-2 lg:col-span-1">
                <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Nombre del cliente *</label>
                <input type="text" name="client_name" value="${escapeHtml(data.client_name || '')}" required
                  class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: María García">
              </div>
              <div>
                <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Teléfono</label>
                <input type="text" name="client_phone" value="${escapeHtml(data.client_phone || '')}"
                  class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+54 9 387...">
              </div>
              <div>
                <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Email</label>
                <input type="email" name="client_email" value="${escapeHtml(data.client_email || '')}"
                  class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="cliente@email.com">
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 class="text-sm font-semibold text-slate-700 mb-4">Datos del proyecto</h2>
            <div class="space-y-4">
              <div>
                <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Título del proyecto *</label>
                <input type="text" name="title" value="${escapeHtml(data.title || '')}" required
                  class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Web para tienda de ropa">
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Tipo</label>
                  <input type="text" name="type" value="${escapeHtml(data.type || '')}"
                    class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: E-commerce, Landing, App">
                </div>
                <div>
                  <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Presupuesto</label>
                  <input type="text" name="budget" value="${escapeHtml(data.budget || '')}"
                    class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: $150.000 ARS">
                </div>
              </div>
              <div>
                <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Descripción del proyecto</label>
                <textarea name="description" rows="4" placeholder="Qué hay que hacer, qué se acordó, alcance del proyecto..."
                  class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500">${escapeHtml(data.description || '')}</textarea>
              </div>
              <div>
                <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Notas adicionales</label>
                <textarea name="notes" rows="3" placeholder="Contactos involucrados, pendientes de consultar, contexto extra..."
                  class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500">${escapeHtml(data.notes || '')}</textarea>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Categoría</label>
                  <select name="category" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    ${PROJECT_CATEGORIES.map(c => `<option value="${c.key}" ${(data.category || 'cliente') === c.key ? 'selected' : ''} style="color:${c.color}">${c.dot} ${c.label}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Deadline (fecha límite)</label>
                  <input type="date" name="deadline" value="${escapeHtml(data.deadline || '')}"
                    class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 p-5">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-semibold text-slate-700">Tareas y pendientes</h2>
              <button type="button" onclick="addTask()" class="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors font-medium">+ Agregar tarea</button>
            </div>
            <div id="taskList" class="space-y-2">
              ${tasks.map((t, i) => taskRowHtml(t, i)).join('')}
            </div>
            <div id="emptyTasks" class="${tasks.length > 0 ? 'hidden' : ''} text-sm text-slate-400 text-center py-4">
              Sin tareas. Hacé clic en "+ Agregar tarea".
            </div>
            <input type="hidden" name="tasks" id="tasksInput" value="${escapeHtml(JSON.stringify(tasks))}">
          </div>
        </div>

        <div class="space-y-5">
          <div class="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 class="text-sm font-semibold text-slate-700 mb-4">Estado</h2>
            <div class="space-y-4">
              <div>
                <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Estado del proyecto</label>
                <select name="status" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">${statusOpts}</select>
              </div>
              <div>
                <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Estado del presupuesto</label>
                <select name="budget_status" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">${budgetOpts}</select>
              </div>
            </div>
          </div>
          <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors">${btnLabel}</button>
        </div>
      </div>
    </form>

    <script>
    let taskCount = ${tasks.length};
    const tasks = ${JSON.stringify(tasks)};

    function taskRowHtml(task, i) {
      return \`<div class="flex items-start gap-2 bg-slate-50 rounded-xl p-3 task-row" data-idx="\${i}">
        <input type="checkbox" class="task-done mt-0.5 flex-shrink-0 w-4 h-4 rounded accent-blue-600" \${task.done ? 'checked' : ''}>
        <div class="flex-1 min-w-0">
          <input type="text" class="task-text w-full bg-transparent text-sm text-slate-700 focus:outline-none placeholder-slate-400 border-b border-transparent focus:border-slate-300" value="\${(task.text||'').replace(/"/g,'&quot;')}" placeholder="Describí la tarea...">
          <div class="flex items-center gap-2 mt-1.5 flex-wrap">
            <select class="task-priority text-xs border-0 bg-transparent text-slate-400 focus:outline-none cursor-pointer">
              <option value="medium" \${task.priority==='medium'?'selected':''}>Prioridad media</option>
              <option value="high" \${task.priority==='high'?'selected':''}>Alta prioridad</option>
              <option value="low" \${task.priority==='low'?'selected':''}>Baja prioridad</option>
            </select>
            <select class="task-assignee text-xs border-0 bg-transparent text-slate-400 focus:outline-none cursor-pointer">
              <option value="" \${!task.assignee?'selected':''}>Sin asignar</option>
              <option value="david" \${task.assignee==='david'?'selected':''}>David</option>
              <option value="hermana" \${task.assignee==='hermana'?'selected':''}>Hermana</option>
              <option value="cliente" \${task.assignee==='cliente'?'selected':''}>Cliente</option>
            </select>
            <input type="date" class="task-due-date text-xs border-0 bg-transparent text-slate-400 focus:outline-none" value="\${task.due_date||''}">
          </div>
        </div>
        <button type="button" onclick="removeTask(\${i})" class="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 text-lg leading-none mt-0.5">×</button>
      </div>\`;
    }

    function addTask() {
      const task = { text: '', done: false, priority: 'medium', assignee: '', due_date: '' };
      tasks.push(task);
      const div = document.createElement('div');
      div.innerHTML = taskRowHtml(task, tasks.length - 1);
      document.getElementById('taskList').appendChild(div.firstElementChild);
      document.getElementById('emptyTasks').classList.add('hidden');
      saveTasks();
      div.querySelector && div.querySelector('.task-text') && div.querySelector('.task-text').focus();
      const rows = document.querySelectorAll('.task-row');
      rows[rows.length-1].querySelector('.task-text').focus();
    }

    function removeTask(i) {
      tasks.splice(i, 1);
      document.getElementById('taskList').innerHTML = tasks.map((t,idx) => taskRowHtml(t, idx)).join('');
      if (tasks.length === 0) document.getElementById('emptyTasks').classList.remove('hidden');
      saveTasks();
    }

    function saveTasks() {
      document.querySelectorAll('.task-row').forEach((row, i) => {
        if (!tasks[i]) return;
        tasks[i].text = row.querySelector('.task-text').value;
        tasks[i].done = row.querySelector('.task-done').checked;
        tasks[i].priority = row.querySelector('.task-priority').value;
        tasks[i].assignee = row.querySelector('.task-assignee').value;
        tasks[i].due_date = row.querySelector('.task-due-date')?.value || '';
      });
      document.getElementById('tasksInput').value = JSON.stringify(tasks);
    }

    document.addEventListener('input', e => { if (e.target.closest('.task-row')) saveTasks(); });
    document.addEventListener('change', e => { if (e.target.closest('.task-row')) saveTasks(); });
    document.getElementById('projectForm').addEventListener('submit', saveTasks);

    function fillClientData(sel) {
      const opt = sel.options[sel.selectedIndex];
      if (!opt.value) return;
      document.querySelector('[name="client_name"]').value = opt.dataset.name || '';
      document.querySelector('[name="client_phone"]').value = opt.dataset.phone || '';
      document.querySelector('[name="client_email"]').value = opt.dataset.email || '';
    }
    </script>`;
}

function taskRowHtml(task, i) {
  const pOpts = [['medium','Prioridad media'],['high','Alta prioridad'],['low','Baja prioridad']];
  const aOpts = [['','Sin asignar'],['david','David'],['hermana','Hermana'],['cliente','Cliente']];
  return `<div class="flex items-start gap-2 bg-slate-50 rounded-xl p-3 task-row" data-idx="${i}">
    <input type="checkbox" class="task-done mt-0.5 flex-shrink-0 w-4 h-4 rounded accent-blue-600" ${task.done ? 'checked' : ''}>
    <div class="flex-1 min-w-0">
      <input type="text" class="task-text w-full bg-transparent text-sm text-slate-700 focus:outline-none placeholder-slate-400 border-b border-transparent focus:border-slate-300" value="${escapeHtml(task.text || '')}" placeholder="Describí la tarea...">
      <div class="flex items-center gap-2 mt-1.5 flex-wrap">
        <select class="task-priority text-xs border-0 bg-transparent text-slate-400 focus:outline-none cursor-pointer">
          ${pOpts.map(([v,l]) => `<option value="${v}" ${(task.priority||'medium')===v?'selected':''}>${l}</option>`).join('')}
        </select>
        <select class="task-assignee text-xs border-0 bg-transparent text-slate-400 focus:outline-none cursor-pointer">
          ${aOpts.map(([v,l]) => `<option value="${v}" ${(task.assignee||'')===v?'selected':''}>${l}</option>`).join('')}
        </select>
        <input type="date" class="task-due-date text-xs border-0 bg-transparent text-slate-400 focus:outline-none cursor-pointer" value="${escapeHtml(task.due_date || '')}" placeholder="">
      </div>
    </div>
    <button type="button" onclick="removeTask(${i})" class="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 text-lg leading-none mt-0.5">×</button>
  </div>`;
}

router.get('/projects/new', requireAuth, async (req, res) => {
  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;
  const clientList = await db.listClientRecords();
  const body = `
    <div class="mb-5"><a href="/admin/projects" class="text-sm text-slate-500 hover:text-blue-600">← Proyectos</a></div>
    <h1 class="text-2xl font-bold text-slate-900 mb-6">Nuevo proyecto</h1>
    ${projectForm({}, '/admin/projects', 'Crear proyecto', clientList)}`;
  res.send(layout('Nuevo proyecto', body, { pendingCount, activePage: 'projects', user: req.session?.user }));
});

router.post('/projects', requireAuth, async (req, res) => {
  let tasks = [];
  try { tasks = JSON.parse(req.body.tasks || '[]'); } catch (e) {}
  const { title, description, status, category, priority, budget, budget_status, client_id, client_name, client_phone, client_email, type, notes, deadline } = req.body;
  const id = await db.createProject({ title, description, status, category, priority, budget, budget_status, client_id: client_id || '', client_name, client_phone, client_email, type, notes, tasks, is_personal: category === 'personal', deadline: deadline || null });
  res.redirect(`/admin/projects/${id}`);
});

// ─── Project detail ───────────────────────────────────────────────────────────

function fileIcon(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️', mp4: '🎬', mov: '🎬', zip: '📦', rar: '📦', fig: '🎨', sketch: '🎨', psd: '🎨', ai: '🎨' };
  return map[ext] || '📎';
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getDirSize(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dirPath)) {
      const full = path.join(dirPath, entry);
      try {
        const stat = fs.statSync(full);
        total += stat.isDirectory() ? getDirSize(full) : stat.size;
      } catch {}
    }
  } catch {}
  return total;
}

router.get('/projects/:id', requireAuth, async (req, res) => {
  const project = await db.getProject(req.params.id);
  if (!project) return res.status(404).send(layout('No encontrado', '<p class="p-4 text-slate-500">Proyecto no encontrado.</p>', { user: req.session?.user }));

  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;

  // Find linked WA conversation by phone
  let linkedConv = null;
  const waPhone = project.client_phone ? 'whatsapp:+' + project.client_phone.replace(/[^0-9]/g, '') : null;
  if (waPhone) {
    linkedConv = await db.getConversation(waPhone);
  }

  // Parse scope from description
  const scopeMatch = (project.description || '').match(/--- Alcance ---\r?\n([\s\S]*?)(?=\r?\n---|$)/);
  const scopeItems = scopeMatch ? scopeMatch[1].split(/\r?\n/).filter(function(l) { return l.trim().startsWith('\u2022'); }).map(function(l) { return l.replace(/^\u2022\s*/, '').trim(); }) : [];

  // Load linked client + all their projects for context
  const linkedClient = project.client_id ? await db.getClientRecord(project.client_id) : null;
  const clientOtherProjects = linkedClient ? (await db.getProjectsByClientId(linkedClient.id)).filter(p => p.id !== project.id) : [];
  const tasks = project.tasks || [];

  // Archivos del proyecto
  const projectFilesDir = path.join(PROJECT_FILES_DIR, project.id);
  const projectFiles = fs.existsSync(projectFilesDir)
    ? fs.readdirSync(projectFilesDir).map(name => ({ name, size: fs.statSync(path.join(projectFilesDir, name)).size }))
    : [];

  // Demo files for this project
  const demoSlug = phoneSlug(project.client_phone);
  const DEMOS_DIR = path.join(__dirname, '..', 'data', 'demos');
  const demoDir = demoSlug ? path.join(DEMOS_DIR, demoSlug) : null;
  const demoExists = demoDir && fs.existsSync(demoDir);
  let demoMainFiles = [];
  let demoVersionDirs = [];
  let demoVersionsJson = [];
  if (demoExists) {
    const entries = fs.readdirSync(demoDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'versions.json') continue;
      const fp = path.join(demoDir, entry.name);
      if (entry.isFile()) {
        const stat = fs.statSync(fp);
        demoMainFiles.push({ name: entry.name, size: stat.size, mtime: stat.mtime });
      } else if (entry.isDirectory() && entry.name.match(/^v\d+$/)) {
        const vFiles = fs.readdirSync(fp).filter(n => !n.startsWith('.')).map(n => {
          const s = fs.statSync(path.join(fp, n));
          return { name: n, size: s.size, mtime: s.mtime };
        });
        demoVersionDirs.push({ version: entry.name, files: vFiles });
      }
    }
    demoVersionDirs.sort((a, b) => {
      const na = parseInt(a.version.replace('v', ''), 10);
      const nb = parseInt(b.version.replace('v', ''), 10);
      return nb - na;
    });
    try {
      const vjFile = path.join(demoDir, 'versions.json');
      if (fs.existsSync(vjFile)) {
        demoVersionsJson = JSON.parse(fs.readFileSync(vjFile, 'utf-8'));
      }
    } catch (e) {}
  }

  const doneTasks = tasks.filter(t => t.done).length;
  const pct = tasks.length > 0 ? Math.round(doneTasks / tasks.length * 100) : 0;
  const updatesLog = project.updates_log || [];

  const priorityBadge = p => {
    if (p === 'high') return '<span class="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Alta</span>';
    if (p === 'low')  return '<span class="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Baja</span>';
    return '';
  };

  const taskRows = tasks.map((t, i) => `
    <form method="POST" action="/admin/projects/${project.id}/task-toggle" class="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0 group">
      <input type="hidden" name="idx" value="${i}">
      <input type="checkbox" name="done" onchange="this.form.submit()" ${t.done ? 'checked' : ''}
        class="mt-0.5 w-4 h-4 rounded flex-shrink-0 accent-blue-600 cursor-pointer">
      <div class="flex-1 min-w-0">
        <div class="text-sm ${t.done ? 'line-through text-slate-400' : 'text-slate-700'}">${escapeHtml(t.text)}</div>
        <div class="flex items-center gap-2 mt-0.5">
          ${priorityBadge(t.priority)}
          ${t.assignee ? `<span class="text-[10px] text-slate-400">${escapeHtml(t.assignee)}</span>` : ''}
          ${t.due_date ? (() => {
            const d = new Date(t.due_date);
            const dl = Math.ceil((d - new Date()) / 86400000);
            const color = dl < 0 ? 'text-red-500' : dl <= 2 ? 'text-orange-500' : 'text-slate-400';
            const label = dl < 0 ? `Vencida` : dl === 0 ? 'Hoy' : `${dl}d`;
            return `<span class="text-[10px] ${color} font-medium">📅 ${label}</span>`;
          })() : ''}
        </div>
      </div>
    </form>`).join('');

  const body = `
    <div class="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <nav class="flex items-center gap-1.5 text-sm text-slate-400">
        <a href="/admin/projects" class="hover:text-blue-600 transition-colors">Proyectos</a>
        <span>/</span>
        <span class="text-slate-600 truncate max-w-xs">${escapeHtml(project.title || project.client_name)}</span>
      </nav>
      <div class="flex gap-3 flex-wrap">
        <a href="/admin/projects/${project.id}/edit" class="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm transition-colors">Editar</a>
        <form method="POST" action="/admin/projects/${project.id}/delete" onsubmit="return confirm('¿Eliminar este proyecto?')">
          <button class="border border-red-200 text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl text-sm transition-colors">Eliminar</button>
        </form>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
      <div>
        ${(() => {
          const avatarColors = ['bg-blue-500','bg-purple-500','bg-emerald-500','bg-orange-500','bg-rose-500','bg-indigo-500'];
          const avatarColor = avatarColors[(project.client_name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length];
          return `<div class="flex items-center gap-3 mb-2">
        <div class="w-10 h-10 rounded-xl ${avatarColor} flex items-center justify-center text-white font-bold text-base flex-shrink-0">
          ${escapeHtml((project.client_name || '?')[0].toUpperCase())}
        </div>
        <div>
          <h1 class="text-2xl font-bold text-slate-900">${escapeHtml(project.title || project.client_name)}</h1>
          <div class="text-sm text-slate-400">${escapeHtml(project.client_name)}${project.client_email ? ` · ${escapeHtml(project.client_email)}` : ''}${project.client_phone ? ` · ${escapeHtml(project.client_phone)}` : ''}</div>
        </div>
      </div>`;
        })()}
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        ${projectStatusBadge(project.status)}
        ${budgetStatusBadge(project.budget_status)}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="lg:col-span-2 space-y-5">

        ${project.description ? (() => {
          const cleanDesc = project.description.replace(/\r?\n?--- Alcance ---\r?\n[\s\S]*?(?=\r?\n---|$)/, '').replace(/\r?\n?--- Demos ---\r?\n[\s\S]*?(?=\r?\n---|$)/, '').trim();
          return cleanDesc ? `
          <div class="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 class="text-sm font-semibold text-slate-700 mb-3">Descripción</h2>
            <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">${escapeHtml(cleanDesc)}</p>
          </div>` : '';
        })() : ''}

        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-slate-700">Tareas y pendientes</h2>
            <div class="flex items-center gap-3">
              ${tasks.length > 0 ? `<span class="text-xs text-slate-400">${doneTasks}/${tasks.length} completadas (${pct}%)</span>` : ''}
              <a href="/admin/projects/${project.id}/edit" class="text-xs text-blue-600 hover:underline">Editar tareas →</a>
            </div>
          </div>
          <form method="POST" action="/admin/projects/${project.id}/add-task" class="mb-4 flex gap-2">
            <input type="text" name="text" placeholder="Agregar tarea rápida..." required
              class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex-shrink-0">+ Agregar</button>
          </form>
          ${tasks.length > 0 ? `
            <div class="bg-slate-100 rounded-full h-2 mb-4">
              <div class="h-2 rounded-full bg-blue-500 transition-all" style="width:${pct}%"></div>
            </div>
            ${taskRows}` : `
            <div class="text-center py-8">
              <div class="text-2xl mb-2">✅</div>
              <p class="text-sm text-slate-400">Sin tareas. Agregá una arriba o <a href="/admin/projects/${project.id}/edit" class="text-blue-600 hover:underline">editá el proyecto</a>.</p>
            </div>`}
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-slate-700">Notas y actualizaciones</h2>
          </div>
          <!-- Quick-add form -->
          <form method="POST" action="/admin/projects/${project.id}/add-update" class="mb-4">
            <div class="flex gap-2">
              <input type="text" name="text" placeholder="Agregar nota rápida... (Ej: Llamé a Berni, arrancamos el viernes)"
                class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required>
              <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex-shrink-0">+ Agregar</button>
            </div>
          </form>
          <!-- Updates feed -->
          ${updatesLog.length > 0 ? `
            <div class="space-y-0">
              ${updatesLog.map((u, i) => `
                <div class="flex gap-3 py-3 ${i < updatesLog.length - 1 ? 'border-b border-slate-100' : ''}">
                  <div class="flex flex-col items-center flex-shrink-0">
                    <div class="w-2 h-2 rounded-full bg-blue-400 mt-1.5"></div>
                    ${i < updatesLog.length - 1 ? '<div class="w-px flex-1 bg-slate-100 mt-1"></div>' : ''}
                  </div>
                  <div class="flex-1 pb-1">
                    <p class="text-sm text-slate-700">${escapeHtml(u.text)}</p>
                    <p class="text-xs text-slate-400 mt-0.5">${new Date(u.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>`).join('')}
            </div>` : `
            <p class="text-sm text-slate-400 text-center py-4">Sin notas todavía. Agregá la primera arriba.</p>`}
          ${project.notes ? `
            <div class="mt-3 pt-3 border-t border-slate-100">
              <p class="text-xs text-slate-400 mb-1">Nota general del proyecto:</p>
              <p class="text-xs text-slate-500 whitespace-pre-wrap">${escapeHtml(project.notes)}</p>
            </div>` : ''}
        </div>

        ${linkedConv ? `
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-slate-700">Conversación WhatsApp <span id="msg-count">(${(linkedConv.history||[]).length} mensajes)</span></h2>
            <div class="flex items-center gap-2">
              <span id="live-dot" class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Auto-refresh activo"></span>
              <span id="live-status" class="text-[10px] text-slate-400">En vivo</span>
              <button onclick="toggleLive()" id="live-toggle" class="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">Pausar</button>
              <a href="/admin/client/${encodeURIComponent(waPhone)}" class="text-xs text-blue-600 hover:underline">Ver pipeline &#8594;</a>
            </div>
          </div>
          <div id="chat-container" class="max-h-96 overflow-y-auto pr-1">
            ` + (linkedConv.history||[]).map(function(m) {
              var isUser = m.role === 'user';
              return '<div class="flex ' + (isUser ? 'justify-start' : 'justify-end') + ' mb-2">' +
                '<div class="max-w-[80%] px-3 py-2 rounded-2xl ' + (isUser ? 'bg-slate-100 rounded-tl-sm' : 'bg-blue-100 rounded-tr-sm') + '">' +
                '<div class="text-[10px] ' + (isUser ? 'text-slate-400' : 'text-blue-400') + ' mb-1 font-medium">' + (isUser ? '\ud83d\udc64 Cliente' : '\ud83e\udd16 Asistente') + '</div>' +
                '<div class="text-sm whitespace-pre-wrap">' + escapeHtml(m.content) + '</div>' +
                '</div></div>';
            }).join('') + `
          </div>
        </div>
        <script>
        (function(){
          var phone = ` + JSON.stringify(waPhone) + `;
          var lastCount = ${(linkedConv.history||[]).length};
          var liveOn = true;
          var interval;
          function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
          function renderMsg(m){
            var isUser = m.role === 'user';
            return '<div class="flex '+(isUser?'justify-start':'justify-end')+' mb-2">'+
              '<div class="max-w-[80%] px-3 py-2 rounded-2xl '+(isUser?'bg-slate-100 rounded-tl-sm':'bg-blue-100 rounded-tr-sm')+'">'+
              '<div class="text-[10px] '+(isUser?'text-slate-400':'text-blue-400')+' mb-1 font-medium">'+(isUser?'\\u{1F464} Cliente':'\\u{1F916} Asistente')+'</div>'+
              '<div class="text-sm whitespace-pre-wrap">'+esc(m.content)+'</div>'+
              '</div></div>';
          }
          function refresh(){
            fetch('/admin/api/conversation/'+encodeURIComponent(phone))
              .then(function(r){return r.json();})
              .then(function(data){
                if(data.messageCount !== lastCount){
                  lastCount = data.messageCount;
                  document.getElementById('msg-count').textContent = '('+lastCount+' mensajes)';
                  var container = document.getElementById('chat-container');
                  container.innerHTML = data.history.map(renderMsg).join('');
                  container.scrollTop = container.scrollHeight;
                }
              }).catch(function(){});
          }
          function startLive(){ interval = setInterval(refresh, 5000); }
          function stopLive(){ clearInterval(interval); }
          window.toggleLive = function(){
            liveOn = !liveOn;
            if(liveOn){ startLive(); }else{ stopLive(); }
            document.getElementById('live-dot').className = liveOn ? 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse' : 'w-2 h-2 rounded-full bg-slate-300';
            document.getElementById('live-status').textContent = liveOn ? 'En vivo' : 'Pausado';
            document.getElementById('live-toggle').textContent = liveOn ? 'Pausar' : 'Reanudar';
          };
          startLive();
          var c = document.getElementById('chat-container');
          if(c) c.scrollTop = c.scrollHeight;
        })();
        </script>` : ''}

        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-slate-700">Archivos</h2>
            <span class="text-xs text-slate-400">${projectFiles.length} archivo${projectFiles.length !== 1 ? 's' : ''}</span>
          </div>
          ${projectFiles.length > 0 ? `
            <div class="space-y-1.5 mb-4">
              ${projectFiles.map(f => `
                <div class="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-slate-50 group">
                  <span class="text-xl flex-shrink-0">${fileIcon(f.name)}</span>
                  <div class="flex-1 min-w-0">
                    <a href="/project-files/${project.id}/${encodeURIComponent(f.name)}" target="_blank"
                      class="text-sm text-slate-700 hover:text-blue-600 hover:underline truncate block">${escapeHtml(f.name)}</a>
                    <span class="text-xs text-slate-400">${formatBytes(f.size)}</span>
                  </div>
                  <form method="POST" action="/admin/projects/${project.id}/files/${encodeURIComponent(f.name)}/delete" onsubmit="return confirm('¿Eliminar ${escapeHtml(f.name)}?')" class="opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="text-slate-300 hover:text-red-400 text-sm transition-colors p-1">✕</button>
                  </form>
                </div>`).join('')}
            </div>` : `
            <div class="text-center py-6 mb-3">
              <div class="text-3xl mb-2">📂</div>
              <p class="text-sm text-slate-400">Sin archivos todavía</p>
            </div>`}
          <form method="POST" action="/admin/projects/${project.id}/upload" enctype="multipart/form-data">
            <label class="flex flex-col items-center gap-2 border-2 border-dashed border-slate-200 rounded-xl p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
              <span class="text-xl">📎</span>
              <span class="text-sm text-slate-500 font-medium">Subir archivos</span>
              <span class="text-xs text-slate-400">PDF, imágenes, docs, videos · Máx. 20MB</span>
              <input type="file" name="files" multiple class="hidden" onchange="this.form.submit()">
            </label>
          </form>
        </div>

        ${demoExists ? `
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-slate-700">Documentos del demo</h2>
            <span class="text-xs text-slate-400">${demoMainFiles.length} archivo${demoMainFiles.length !== 1 ? 's' : ''} · ${demoVersionDirs.length} versión${demoVersionDirs.length !== 1 ? 'es' : ''}</span>
          </div>

          ${demoMainFiles.length > 0 ? `
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Archivos actuales</div>
            <div class="space-y-1.5 mb-4">
              ${demoMainFiles.map(f => `
                <div class="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-slate-50 group">
                  <span class="text-xl flex-shrink-0">${fileIcon(f.name)}</span>
                  <div class="flex-1 min-w-0">
                    <a href="/demos/${demoSlug}/${encodeURIComponent(f.name)}" target="_blank"
                      class="text-sm text-slate-700 hover:text-blue-600 hover:underline truncate block">${escapeHtml(f.name)}</a>
                    <span class="text-xs text-slate-400">${formatBytes(f.size)}</span>
                  </div>
                  <form method="POST" action="/admin/projects/${project.id}/demo-file-delete" onsubmit="return confirm('¿Eliminar ${escapeHtml(f.name)} del demo?')" class="opacity-0 group-hover:opacity-100 transition-opacity">
                    <input type="hidden" name="filepath" value="${escapeHtml(f.name)}">
                    <button class="text-slate-300 hover:text-red-400 text-sm transition-colors p-1">✕</button>
                  </form>
                </div>`).join('')}
            </div>` : `
            <div class="text-center py-4 mb-3">
              <p class="text-sm text-slate-400">Sin archivos demo en el directorio principal</p>
            </div>`}

          ${demoVersionDirs.length > 0 ? `
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-4">Versiones anteriores</div>
            ${demoVersionDirs.map(vd => `
              <div class="mb-2 border border-slate-100 rounded-xl overflow-hidden">
                <button onclick="this.nextElementSibling.classList.toggle('hidden');this.querySelector('.chevron').classList.toggle('rotate-90')" class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors">
                  <span class="chevron text-slate-400 text-xs transition-transform">&#9656;</span>
                  <span class="text-sm font-medium text-slate-600">${escapeHtml(vd.version)}</span>
                  <span class="text-xs text-slate-400">${vd.files.length} archivo${vd.files.length !== 1 ? 's' : ''}</span>
                </button>
                <div class="hidden px-3 pb-2 space-y-1">
                  ${vd.files.map(f => `
                    <div class="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-slate-50 group">
                      <span class="text-lg flex-shrink-0">${fileIcon(f.name)}</span>
                      <div class="flex-1 min-w-0">
                        <a href="/demos/${demoSlug}/${vd.version}/${encodeURIComponent(f.name)}" target="_blank"
                          class="text-xs text-slate-600 hover:text-blue-600 hover:underline truncate block">${escapeHtml(f.name)}</a>
                        <span class="text-[10px] text-slate-400">${formatBytes(f.size)}</span>
                      </div>
                      <form method="POST" action="/admin/projects/${project.id}/demo-file-delete" onsubmit="return confirm('¿Eliminar ${escapeHtml(vd.version + '/' + f.name)}?')" class="opacity-0 group-hover:opacity-100 transition-opacity">
                        <input type="hidden" name="filepath" value="${escapeHtml(vd.version + '/' + f.name)}">
                        <button class="text-slate-300 hover:text-red-400 text-xs transition-colors p-1">✕</button>
                      </form>
                    </div>`).join('')}
                </div>
              </div>`).join('')}
          ` : ''}

          ${demoVersionsJson.length > 0 ? `
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-4">Historial de versiones</div>
            <div class="space-y-1.5">
              ${demoVersionsJson.map(v => `
                <div class="flex items-start gap-2 text-xs py-1.5">
                  <span class="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-mono font-semibold flex-shrink-0">${escapeHtml(v.version || v.tag || '?')}</span>
                  <div class="flex-1 min-w-0">
                    <div class="text-slate-600">${escapeHtml(v.note || v.reason || 'Sin nota')}</div>
                    ${v.date ? `<div class="text-[10px] text-slate-400 mt-0.5">${new Date(v.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>` : ''}
                  </div>
                </div>`).join('')}
            </div>
          ` : ''}

          <form method="POST" action="/admin/projects/${project.id}/demo-upload" enctype="multipart/form-data" class="mt-4">
            <label class="flex flex-col items-center gap-2 border-2 border-dashed border-slate-200 rounded-xl p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
              <span class="text-xl">📎</span>
              <span class="text-sm text-slate-500 font-medium">Subir archivos al demo</span>
              <span class="text-xs text-slate-400">Se guardan en data/demos/${demoSlug}/</span>
              <input type="file" name="demofiles" multiple class="hidden" onchange="this.form.submit()">
            </label>
          </form>
        </div>` : ''}
      </div>

      <div class="space-y-5">
        ${tasks.filter(t => !t.done && t.priority === 'high').length > 0 ? `
          <div class="bg-red-50 border border-red-200 rounded-2xl p-4">
            <h2 class="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">🔥 Alta prioridad</h2>
            <div class="space-y-1.5">
              ${tasks.filter(t => !t.done && t.priority === 'high').map(t => `
                <div class="text-xs text-red-700 flex items-start gap-1.5"><span class="mt-0.5">•</span><span>${escapeHtml(t.text)}</span></div>`).join('')}
            </div>
          </div>` : ''}
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-4">Detalles</h2>
          ${tasks.length > 0 ? `
          <div class="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl">
            <div class="relative flex-shrink-0" style="width:44px;height:44px">
              <svg width="44" height="44" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="#e2e8f0" stroke-width="4"/>
                <circle cx="22" cy="22" r="18" fill="none" stroke="${pct === 100 ? '#10b981' : '#3b82f6'}" stroke-width="4"
                  stroke-dasharray="${Math.round(2 * Math.PI * 18)}"
                  stroke-dashoffset="${Math.round(2 * Math.PI * 18 * (1 - pct / 100))}"
                  stroke-linecap="round"
                  transform="rotate(-90 22 22)"/>
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-[10px] font-bold ${pct === 100 ? 'text-emerald-600' : 'text-blue-600'}">${pct}%</span>
              </div>
            </div>
            <div>
              <div class="text-sm font-semibold text-slate-700">${doneTasks}/${tasks.length} tareas</div>
              <div class="text-xs text-slate-400">${pct === 100 ? 'Completado ✓' : `${tasks.length - doneTasks} pendiente${tasks.length - doneTasks !== 1 ? 's' : ''}`}</div>
            </div>
          </div>` : ''}
          <div class="space-y-3 text-sm">
            ${project.type ? `<div><div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Tipo</div><div class="text-slate-700 font-medium">${escapeHtml(project.type)}</div></div>` : ''}
            ${project.budget ? `<div><div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Presupuesto</div><div class="text-slate-700 font-semibold text-base">${escapeHtml(project.budget)}</div></div>` : ''}
            <div><div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Estado</div>${projectStatusBadge(project.status)}</div>
            <div><div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Estado del cobro</div>${budgetStatusBadge(project.budget_status)}</div>
            <div><div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Última actividad</div><div class="text-slate-600">${timeAgo(project.updated_at)}</div></div>
            ${project.deadline ? (() => {
              const d = new Date(project.deadline);
              const daysLeft = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
              const isPast = daysLeft < 0;
              const isUrgent = daysLeft >= 0 && daysLeft <= 3;
              const color = isPast ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-emerald-600';
              const label = isPast ? `Vencida (hace ${Math.abs(daysLeft)}d)` : daysLeft === 0 ? '¡Hoy!' : `en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`;
              return `<div>
                <div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Deadline</div>
                <div class="text-sm font-semibold ${color}">📅 ${d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div class="text-xs ${color} mt-0.5">${label}</div>
              </div>`;
            })() : ''}
            <div><div class="text-xs text-slate-400 uppercase tracking-wide mb-1">Categoría</div>${categoryBadge(project.category || 'cliente')}</div>
            ${project.client_phone ? `<div><div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Teléfono</div><a href="tel:${escapeHtml(project.client_phone)}" class="text-blue-600 hover:underline text-sm">${escapeHtml(project.client_phone)}</a></div>` : ''}
            ${project.client_email ? `<div><div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Email</div><a href="mailto:${escapeHtml(project.client_email)}" class="text-blue-600 hover:underline text-sm truncate block">${escapeHtml(project.client_email)}</a></div>` : ''}
            ${project.created_at ? `<div><div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Creado</div><div class="text-slate-600 text-sm">${new Date(project.created_at + (project.created_at.endsWith('Z') ? '' : 'Z')).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>` : ''}
          </div>
          <div class="mt-4 pt-4 border-t border-slate-100">
            <a href="/admin/projects/${project.id}/edit" class="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">✏️ Editar proyecto</a>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-3">Acciones rápidas</h2>
          <div class="space-y-2">

            ${demoExists
              ? `<a href="/admin/review/${encodeURIComponent(waPhone || '')}" class="flex items-center gap-2 w-full border border-orange-200 text-orange-700 hover:bg-orange-50 py-2 px-3 rounded-xl text-xs font-medium transition-colors">🎨 Modificar demo</a>`
              : `<button disabled class="flex items-center gap-2 w-full border border-slate-100 text-slate-300 py-2 px-3 rounded-xl text-xs font-medium cursor-not-allowed">🎨 Modificar demo (sin demo)</button>`}

            <button onclick="document.getElementById('notice-form').classList.toggle('hidden')" class="flex items-center gap-2 w-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50 py-2 px-3 rounded-xl text-xs font-medium transition-colors">💬 Enviar aviso al cliente</button>
            <form id="notice-form" method="POST" action="/admin/projects/${project.id}/send-notice" class="hidden pl-2 space-y-2 mt-1 mb-1">
              <textarea name="message" rows="3" placeholder="Escribí el mensaje para el cliente..." required
                class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"></textarea>
              <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-medium transition-colors">Enviar por WhatsApp</button>
            </form>

            <button onclick="document.getElementById('meeting-form').classList.toggle('hidden')" class="flex items-center gap-2 w-full border border-blue-200 text-blue-700 hover:bg-blue-50 py-2 px-3 rounded-xl text-xs font-medium transition-colors">📅 Programar reunión</button>
            <form id="meeting-form" method="POST" action="/admin/schedule-meeting/${encodeURIComponent(waPhone || '')}" class="hidden pl-2 space-y-2 mt-1 mb-1">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-[10px] text-slate-400 block mb-0.5">Fecha</label>
                  <input type="date" name="date" value="${(() => { const d = new Date(); d.setDate(d.getDate() + (d.getDay() === 5 ? 3 : d.getDay() === 6 ? 2 : 1)); return d.toISOString().split('T')[0]; })()}"
                    class="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                  <label class="text-[10px] text-slate-400 block mb-0.5">Hora</label>
                  <input type="time" name="time" value="10:00"
                    class="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
              </div>
              <div>
                <label class="text-[10px] text-slate-400 block mb-0.5">Duración</label>
                <select name="duration" class="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="15">15 minutos</option>
                  <option value="30" selected>30 minutos</option>
                  <option value="60">1 hora</option>
                </select>
              </div>
              <div>
                <label class="text-[10px] text-slate-400 block mb-0.5">Asunto</label>
                <input type="text" name="subject" value="${escapeHtml(project.title || project.client_name)}"
                  class="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
              <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-xs font-medium transition-colors">Crear evento en Calendar</button>
            </form>

            <button onclick="document.getElementById('scope-form').classList.toggle('hidden')" class="flex items-center gap-2 w-full border border-purple-200 text-purple-700 hover:bg-purple-50 py-2 px-3 rounded-xl text-xs font-medium transition-colors">⚙ Agregar funcionalidades</button>
            <form id="scope-form" method="POST" action="/admin/projects/${project.id}/add-scope" class="hidden pl-2 space-y-2 mt-1 mb-1">
              <input type="text" name="feature" placeholder="Ej: Integración con MercadoPago" required
                class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <button type="submit" class="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-xl text-xs font-medium transition-colors">Agregar al alcance</button>
            </form>

            <button onclick="document.getElementById('version-form').classList.toggle('hidden')" class="flex items-center gap-2 w-full border border-indigo-200 text-indigo-700 hover:bg-indigo-50 py-2 px-3 rounded-xl text-xs font-medium transition-colors">📌 Nueva versión</button>
            <form id="version-form" method="POST" action="/admin/projects/${project.id}/new-version" class="hidden pl-2 space-y-2 mt-1 mb-1">
              <textarea name="version_notes" rows="2" placeholder="Notas de esta versión..." required
                class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"></textarea>
              <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-xs font-medium transition-colors">Crear versión</button>
            </form>

          </div>
        </div>

        ${scopeItems.length > 0 ? `
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-3">Alcance del proyecto</h2>
          <div class="space-y-2">
            ` + scopeItems.map(function(f) { return '<div class="flex items-start gap-2 text-xs text-slate-600"><span class="text-blue-500 mt-0.5 flex-shrink-0">' + String.fromCharCode(9656) + '</span>' + escapeHtml(f) + '</div>'; }).join('') + `
          </div>
          <div class="text-[10px] text-slate-400 mt-3">${scopeItems.length} funcionalidades definidas</div>
        </div>` : ''}
        ${linkedConv ? `
        <div class="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div class="text-xs font-semibold text-blue-700 mb-1">Pipeline del lead</div>
          <div class="text-[10px] text-blue-600 mb-2">Ver el recorrido completo del cliente desde el primer contacto</div>
          <a href="/admin/client/${encodeURIComponent(waPhone)}" class="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-xs font-medium transition-colors">Ver pipeline del lead &#8594;</a>
        </div>` : ''}
        ${linkedClient ? (() => {
          const avatarColors = ['bg-blue-500','bg-purple-500','bg-emerald-500','bg-orange-500','bg-rose-500','bg-indigo-500'];
          const bg = avatarColors[linkedClient.name.split('').reduce((a,c) => a + c.charCodeAt(0), 0) % avatarColors.length];
          return `
  <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
    <div class="p-4 border-b border-slate-100">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Cliente vinculado</h2>
        <a href="/admin/clientes/${linkedClient.id}" class="text-xs text-blue-600 hover:underline font-medium">Ficha completa →</a>
      </div>
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 rounded-xl ${bg} flex items-center justify-center text-white font-bold text-base flex-shrink-0">
          ${(linkedClient.name[0]||'?').toUpperCase()}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(linkedClient.name)}</div>
          ${linkedClient.company ? `<div class="text-xs text-slate-500 truncate">${escapeHtml(linkedClient.company)}</div>` : ''}
          <div class="mt-0.5">${clientCategoryBadge(linkedClient.category)}</div>
        </div>
      </div>
      <div class="space-y-1.5">
        ${linkedClient.phone ? `<div class="flex items-center gap-2">
          <span class="text-slate-400 text-xs">📞</span>
          <a href="tel:${escapeHtml(linkedClient.phone)}" class="text-xs text-blue-600 hover:underline flex-1 truncate">${escapeHtml(linkedClient.phone)}</a>
          <a href="https://wa.me/${linkedClient.phone.replace(/\D/g,'')}" target="_blank" class="text-xs text-emerald-600 hover:underline flex-shrink-0">WA ↗</a>
        </div>` : ''}
        ${linkedClient.email ? `<div class="flex items-center gap-2">
          <span class="text-slate-400 text-xs">✉️</span>
          <a href="mailto:${escapeHtml(linkedClient.email)}" class="text-xs text-blue-600 hover:underline flex-1 truncate">${escapeHtml(linkedClient.email)}</a>
        </div>` : ''}
      </div>
      ${linkedClient.notes ? `<div class="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-2 line-clamp-2 italic">"${escapeHtml(linkedClient.notes.slice(0,120))}"</div>` : ''}
    </div>
    ${clientOtherProjects.length > 0 ? `
    <div class="p-4">
      <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Otros proyectos del cliente (${clientOtherProjects.length})</div>
      <div class="space-y-1.5">
        ${clientOtherProjects.slice(0,3).map(p => {
          const cat2 = PROJECT_CATEGORIES.find(c => c.key === (p.category||'cliente')) || PROJECT_CATEGORIES[0];
          return `<a href="/admin/projects/${p.id}" class="flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-lg hover:bg-slate-50 transition-colors">
            <div class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:${cat2.color}"></div>
            <span class="text-xs text-slate-700 truncate flex-1">${escapeHtml(p.title||p.client_name)}</span>
            ${p.budget ? `<span class="text-xs font-medium text-slate-500 flex-shrink-0">${escapeHtml(p.budget)}</span>` : projectStatusBadge(p.status)}
          </a>`;
        }).join('')}
        ${clientOtherProjects.length > 3 ? `<div class="text-xs text-center text-slate-400 pt-1">+${clientOtherProjects.length-3} más</div>` : ''}
      </div>
    </div>` : `<div class="p-3 text-center text-xs text-slate-400">Único proyecto de este cliente</div>`}
  </div>`;
        })() : ''}
      </div>
    </div>`;

  res.send(layout(project.title || project.client_name, body, { pendingCount, activePage: 'projects', user: req.session?.user }));
});

// ─── Edit project ─────────────────────────────────────────────────────────────

router.get('/projects/:id/edit', requireAuth, async (req, res) => {
  const project = await db.getProject(req.params.id);
  if (!project) return res.redirect('/admin/projects');
  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;
  const clientList = await db.listClientRecords();
  const body = `
    <div class="mb-5"><a href="/admin/projects/${project.id}" class="text-sm text-slate-500 hover:text-blue-600">← ${escapeHtml(project.title || project.client_name)}</a></div>
    <h1 class="text-2xl font-bold text-slate-900 mb-6">Editar proyecto</h1>
    ${projectForm(project, `/admin/projects/${project.id}/update`, 'Guardar cambios', clientList)}`;
  res.send(layout('Editar proyecto', body, { pendingCount, activePage: 'projects', user: req.session?.user }));
});

router.post('/projects/:id/update', requireAuth, async (req, res) => {
  let tasks = [];
  try { tasks = JSON.parse(req.body.tasks || '[]'); } catch (e) {}
  const { title, description, status, category, priority, budget, budget_status, client_id, client_name, client_phone, client_email, type, notes, deadline } = req.body;
  await db.updateProject(req.params.id, { title, description, status, category, priority, budget, budget_status, client_id: client_id || '', client_name, client_phone, client_email, type, notes, tasks, is_personal: category === 'personal', deadline: deadline || null });
  res.redirect(`/admin/projects/${req.params.id}`);
});

router.post('/projects/:id/add-update', requireAuth, async (req, res) => {
  const text = (req.body.text || '').trim();
  if (text) await db.addProjectUpdate(req.params.id, text);
  res.redirect(`/admin/projects/${req.params.id}`);
});

router.post('/projects/:id/add-task', requireAuth, async (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.redirect(`/admin/projects/${req.params.id}`);
  const project = await db.getProject(req.params.id);
  if (!project) return res.redirect('/admin/projects');
  const tasks = project.tasks || [];
  tasks.push({ text, done: false, priority: 'medium', assignee: '', due_date: '' });
  await db.updateProject(req.params.id, { ...project, tasks });
  res.redirect(`/admin/projects/${req.params.id}`);
});

router.post('/projects/:id/task-toggle', requireAuth, async (req, res) => {
  const project = await db.getProject(req.params.id);
  if (!project) return res.redirect('/admin/projects');
  const idx = parseInt(req.body.idx, 10);
  const tasks = project.tasks || [];
  if (tasks[idx]) tasks[idx].done = req.body.done === 'on';
  await db.updateProject(req.params.id, { ...project, tasks });
  res.redirect(`/admin/projects/${req.params.id}`);
});

router.post('/projects/:id/delete', requireAuth, async (req, res) => {
  await db.deleteProject(req.params.id);
  res.redirect('/admin/projects');
});

// ─── Archivos de proyecto ─────────────────────────────────────────────────────

router.post('/projects/:id/upload', requireAuth, (req, res, next) => {
  upload.array('files', 20)(req, res, err => {
    if (err) console.error('[upload] Error:', err.message);
    res.redirect(`/admin/projects/${req.params.id}`);
  });
});

router.post('/projects/:id/files/:filename/delete', requireAuth, (req, res) => {
  const filePath = safePath(PROJECT_FILES_DIR, req.params.id, req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.redirect(`/admin/projects/${req.params.id}`);
});

// ─── Project actions: send notice, add scope, new version, demo upload/delete ──

router.post('/projects/:id/send-notice', requireAuth, async (req, res) => {
  const project = await db.getProject(req.params.id);
  if (!project) return res.redirect('/admin/projects');
  const message = (req.body.message || '').trim();
  if (message && project.client_phone) {
    try {
      const waPhone = 'whatsapp:+' + project.client_phone.replace(/[^0-9]/g, '');
      const { sendMessage } = require('./whatsapp');
      await sendMessage(waPhone, message);
      await db.addProjectUpdate(req.params.id, `Aviso enviado al cliente por WhatsApp: "${message.slice(0, 80)}${message.length > 80 ? '...' : ''}"`);
    } catch (err) {
      console.error('[send-notice] Error:', err.message);
      await db.addProjectUpdate(req.params.id, `Error al enviar aviso WA: ${err.message}`);
    }
  }
  res.redirect(`/admin/projects/${req.params.id}`);
});

router.post('/projects/:id/add-scope', requireAuth, async (req, res) => {
  const project = await db.getProject(req.params.id);
  if (!project) return res.redirect('/admin/projects');
  const feature = (req.body.feature || '').trim();
  if (feature) {
    let desc = project.description || '';
    const scopeMarker = '--- Alcance ---';
    if (desc.includes(scopeMarker)) {
      // Find end of scope section and append bullet
      const scopeIdx = desc.indexOf(scopeMarker) + scopeMarker.length;
      const afterScope = desc.slice(scopeIdx);
      const endMatch = afterScope.match(/\r?\n---|\r?\n\r?\n/);
      const insertPos = endMatch ? scopeIdx + endMatch.index : desc.length;
      desc = desc.slice(0, insertPos) + '\n\u2022 ' + feature + desc.slice(insertPos);
    } else {
      desc += '\n\n--- Alcance ---\n\u2022 ' + feature;
    }
    await db.updateProject(req.params.id, { description: desc });
    await db.addProjectUpdate(req.params.id, `Funcionalidad agregada al alcance: "${feature}"`);
  }
  res.redirect(`/admin/projects/${req.params.id}`);
});

router.post('/projects/:id/new-version', requireAuth, async (req, res) => {
  const project = await db.getProject(req.params.id);
  if (!project) return res.redirect('/admin/projects');
  const notes = (req.body.version_notes || '').trim();
  if (!notes) return res.redirect(`/admin/projects/${req.params.id}`);

  // Determine version number
  const slug = phoneSlug(project.client_phone);
  const DEMOS_DIR = path.join(__dirname, '..', 'data', 'demos');
  const demoDir = slug ? path.join(DEMOS_DIR, slug) : null;
  let versionNum = 1;

  if (demoDir && fs.existsSync(demoDir)) {
    // Find highest existing version dir
    const entries = fs.readdirSync(demoDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.match(/^v\d+$/)) {
        const num = parseInt(entry.name.replace('v', ''), 10);
        if (num >= versionNum) versionNum = num + 1;
      }
    }

    // Copy current files to version subdirectory
    const versionDir = path.join(demoDir, `v${versionNum}`);
    fs.mkdirSync(versionDir, { recursive: true });
    const mainFiles = entries.filter(e => e.isFile() && !e.name.startsWith('.') && e.name !== 'versions.json');
    for (const f of mainFiles) {
      fs.copyFileSync(path.join(demoDir, f.name), path.join(versionDir, f.name));
    }

    // Update versions.json
    const vjFile = path.join(demoDir, 'versions.json');
    let versions = [];
    try { if (fs.existsSync(vjFile)) versions = JSON.parse(fs.readFileSync(vjFile, 'utf-8')); } catch (e) {}
    versions.push({ version: `v${versionNum}`, note: notes, date: new Date().toISOString() });
    fs.writeFileSync(vjFile, JSON.stringify(versions, null, 2));
  }

  await db.addProjectUpdate(req.params.id, `\ud83d\udccc Versión ${versionNum}: ${notes}`);
  res.redirect(`/admin/projects/${req.params.id}`);
});

// Demo file upload for project
const demoUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const DEMOS_DIR = path.join(__dirname, '..', 'data', 'demos');
    (async () => {
      try {
        const project = await db.getProject(req.params.id);
        const slug = phoneSlug(project?.client_phone);
        if (!slug) return cb(new Error('No client phone'));
        const dir = path.join(DEMOS_DIR, slug);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      } catch (e) { cb(e); }
    })();
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._\-áéíóúÁÉÍÓÚñÑ ]/g, '_');
    cb(null, safe);
  },
});
const demoUpload = multer({ storage: demoUploadStorage, limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/projects/:id/demo-upload', requireAuth, (req, res, next) => {
  demoUpload.array('demofiles', 20)(req, res, err => {
    if (err) console.error('[demo-upload] Error:', err.message);
    res.redirect(`/admin/projects/${req.params.id}`);
  });
});

router.post('/projects/:id/demo-file-delete', requireAuth, async (req, res) => {
  const project = await db.getProject(req.params.id);
  if (!project) return res.redirect('/admin/projects');
  const slug = phoneSlug(project.client_phone);
  if (!slug) return res.redirect(`/admin/projects/${req.params.id}`);
  const DEMOS_DIR = path.join(__dirname, '..', 'data', 'demos');
  const relativePath = (req.body.filepath || '').replace(/\.\./g, '').replace(/^\//, '');
  if (!relativePath) return res.redirect(`/admin/projects/${req.params.id}`);
  const filePath = safePath(path.join(DEMOS_DIR, slug), relativePath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.redirect(`/admin/projects/${req.params.id}`);
});

// ─── Clientes CRM ─────────────────────────────────────────────────────────────

function clientForm(data = {}, action = '/admin/clientes', btnLabel = 'Guardar') {
  const catOpts = CLIENT_CATEGORIES.map(c =>
    `<option value="${c.key}" ${(data.category || 'cliente') === c.key ? 'selected' : ''}>${c.label}</option>`).join('');
  return `
    <form method="POST" action="${action}">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2 space-y-5">
          <div class="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 class="text-sm font-semibold text-slate-700 mb-4">Datos del cliente</h2>
            <div class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="sm:col-span-2">
                  <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Nombre completo *</label>
                  <input type="text" name="name" value="${escapeHtml(data.name || '')}" required
                    class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: María García">
                </div>
                <div>
                  <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Empresa / Negocio</label>
                  <input type="text" name="company" value="${escapeHtml(data.company || '')}"
                    class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Panadería Don Héctor">
                </div>
                <div>
                  <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Tipo</label>
                  <select name="category" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">${catOpts}</select>
                </div>
                <div>
                  <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Teléfono</label>
                  <input type="text" name="phone" value="${escapeHtml(data.phone || '')}"
                    class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+54 9 387...">
                </div>
                <div>
                  <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Email</label>
                  <input type="email" name="email" value="${escapeHtml(data.email || '')}"
                    class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="cliente@email.com">
                </div>
              </div>
              <div>
                <label class="text-xs text-slate-500 uppercase tracking-wide block mb-1">Notas</label>
                <textarea name="notes" rows="4" placeholder="Historial, preferencias, contexto del cliente..."
                  class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500">${escapeHtml(data.notes || '')}</textarea>
              </div>
            </div>
          </div>
        </div>
        <div>
          <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors">${btnLabel}</button>
        </div>
      </div>
    </form>`;
}

router.get('/clientes', requireAuth, async (req, res) => {
  const clients = await db.listClientRecords();
  const projects = await db.listProjects();
  const allWaClients = await db.listAllClients();
  const pendingCount = allWaClients.filter(c => c.demo_status === 'pending_review').length;
  const search = (req.query.q || '').toLowerCase();
  const catFilter = req.query.cat || 'all';

  let filtered = clients;
  if (search) filtered = filtered.filter(c =>
    c.name.toLowerCase().includes(search) || c.email.toLowerCase().includes(search) ||
    c.phone.includes(search) || c.company.toLowerCase().includes(search));
  if (catFilter !== 'all') filtered = filtered.filter(c => c.category === catFilter);

  // Project count per client
  const projCount = id => projects.filter(p => p.client_id === id).length;

  const catTabs = [{ key: 'all', label: 'Todos', count: clients.length },
    ...CLIENT_CATEGORIES.map(c => ({ key: c.key, label: c.label, count: clients.filter(cl => cl.category === c.key).length }))
  ].filter(t => t.key === 'all' || t.count > 0);

  const tabHtml = catTabs.map(t => `
    <a href="/admin/clientes?cat=${t.key}${search ? '&q=' + encodeURIComponent(search) : ''}"
      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${catFilter === t.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}">
      ${t.label} <span class="text-xs ${catFilter === t.key ? 'opacity-70' : 'text-slate-400'}">${t.count}</span>
    </a>`).join('');

  const rows = filtered.map(c => {
    const pc = projCount(c.id);
    const initial = (c.name[0] || '?').toUpperCase();
    const colors = ['bg-blue-100 text-blue-600','bg-purple-100 text-purple-600','bg-emerald-100 text-emerald-600','bg-orange-100 text-orange-600','bg-rose-100 text-rose-600'];
    const color = colors[c.name.split('').reduce((a,ch) => a + ch.charCodeAt(0), 0) % colors.length];
    return `
      <tr class="border-b border-slate-100 hover:bg-blue-50/30 transition-colors cursor-pointer group" onclick="location.href='/admin/clientes/${c.id}'">
        <td class="px-4 py-3.5">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full ${color} flex items-center justify-center font-bold text-sm flex-shrink-0">${initial}</div>
            <div>
              <div class="font-medium text-slate-800">${escapeHtml(c.name)}</div>
              ${c.company ? `<div class="text-xs text-slate-400">${escapeHtml(c.company)}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="px-4 py-3.5">${clientCategoryBadge(c.category)}</td>
        <td class="px-4 py-3.5 text-sm text-slate-500">
          ${c.phone ? `<div class="text-xs">${escapeHtml(c.phone)}</div>` : ''}
          ${c.email ? `<div class="text-xs text-slate-400">${escapeHtml(c.email)}</div>` : ''}
        </td>
        <td class="px-4 py-3.5">
          ${pc > 0 ? `<span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">${pc} proyecto${pc !== 1 ? 's' : ''}</span>` : '<span class="text-xs text-slate-300">—</span>'}
        </td>
        <td class="px-4 py-3.5 text-xs text-slate-400">${timeAgo(c.updated_at)}</td>
        <td class="px-4 py-3.5 text-right">
          <a href="/admin/clientes/${c.id}" class="opacity-0 group-hover:opacity-100 text-blue-600 text-xs transition-opacity" onclick="event.stopPropagation()">Abrir →</a>
        </td>
      </tr>`;
  }).join('');

  const emptyState = `<div class="text-center py-20">
    <div class="text-5xl mb-4">👥</div>
    <h3 class="text-lg font-semibold text-slate-700 mb-2">Sin clientes todavía</h3>
    <p class="text-sm text-slate-400 mb-6">Creá tu primer cliente para asociarlo a proyectos.</p>
    <a href="/admin/clientes/new" class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">+ Nuevo cliente</a>
  </div>`;

  const body = `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 class="text-xl md:text-2xl font-bold text-slate-900">Clientes</h1>
        <div class="text-sm text-slate-400 mt-0.5">${clients.length} cliente${clients.length !== 1 ? 's' : ''} en total</div>
      </div>
      <a href="/admin/clientes/new" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">+ Nuevo cliente</a>
    </div>
    <div class="flex items-center gap-3 mb-4">
      <form method="GET" action="/admin/clientes" class="flex-1">
        <input type="hidden" name="cat" value="${escapeHtml(catFilter)}">
        <input type="text" name="q" value="${escapeHtml(search)}" placeholder="Buscar por nombre, empresa, email o teléfono..."
          class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      </form>
    </div>
    <div class="flex items-center gap-1.5 mb-5 flex-wrap">${tabHtml}</div>
    ${filtered.length === 0 && clients.length === 0 ? emptyState : `
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div class="overflow-x-auto">
      <table class="w-full min-w-[560px]">
        <thead class="border-b border-slate-100">
          <tr class="text-xs text-slate-400 uppercase">
            <th class="px-4 py-3 text-left font-medium">Cliente</th>
            <th class="px-4 py-3 text-left font-medium">Tipo</th>
            <th class="px-4 py-3 text-left font-medium">Contacto</th>
            <th class="px-4 py-3 text-left font-medium">Proyectos</th>
            <th class="px-4 py-3 text-left font-medium">Actividad</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td class="px-4 py-12 text-center text-slate-400 text-sm" colspan="6">Sin resultados</td></tr>'}</tbody>
      </table>
      </div>
    </div>`}`;

  res.send(layout('Clientes', body, { pendingCount, activePage: 'clientes', user: req.session?.user }));
});

router.get('/clientes/new', requireAuth, async (req, res) => {
  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;
  const prefill = {
    phone: req.query.phone || '',
    name: req.query.name || '',
    email: req.query.email || '',
  };
  const body = `
    <div class="mb-5"><a href="/admin/clientes" class="text-sm text-slate-500 hover:text-blue-600">← Clientes</a></div>
    <h1 class="text-2xl font-bold text-slate-900 mb-6">Nuevo cliente</h1>
    ${clientForm(prefill, '/admin/clientes')}`;
  res.send(layout('Nuevo cliente', body, { pendingCount, activePage: 'clientes', user: req.session?.user }));
});

router.post('/clientes', requireAuth, async (req, res) => {
  const { name, company, category, phone, email, notes } = req.body;
  const id = await db.createClientRecord({ name, company, category, phone, email, notes });
  res.redirect(`/admin/clientes/${id}`);
});

router.get('/clientes/:id', requireAuth, async (req, res) => {
  const client = await db.getClientRecord(req.params.id);
  if (!client) return res.status(404).send(layout('No encontrado', '<p class="p-4 text-slate-500">Cliente no encontrado.</p>', {}));

  const clientProjects = await db.getProjectsByClientId(req.params.id);
  const allProjects = await db.listProjects();
  // Proyectos sin cliente asignado o de otro cliente (para poder vincular)
  const unlinkableProjects = allProjects.filter(p => !p.client_id || p.client_id === '');
  const allWa = await db.listAllClients();
  const pendingCount = allWa.filter(c => c.demo_status === 'pending_review').length;

  const initial = (client.name[0] || '?').toUpperCase();
  const avatarColors = ['bg-blue-500','bg-purple-500','bg-emerald-500','bg-orange-500','bg-rose-500','bg-indigo-500'];
  const avatarColor = avatarColors[client.name.split('').reduce((a,c) => a + c.charCodeAt(0), 0) % avatarColors.length];

  const projectCards = clientProjects.map(p => {
    const cat = PROJECT_CATEGORIES.find(c => c.key === (p.category || 'cliente')) || PROJECT_CATEGORIES[0];
    const tasks = p.tasks || [];
    const pending = tasks.filter(t => !t.done).length;
    const pct = tasks.length > 0 ? Math.round(tasks.filter(t => t.done).length / tasks.length * 100) : 0;
    return `
    <div class="border border-slate-100 rounded-xl overflow-hidden hover:border-slate-200 transition-colors" style="border-left: 3px solid ${cat.color}">
      <div class="flex items-center gap-3 p-3">
        <div class="flex-1 min-w-0" onclick="location.href='/admin/projects/${p.id}'" style="cursor:pointer">
          <div class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(p.title || p.client_name)}</div>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            ${projectStatusBadge(p.status)}
            ${p.budget ? `<span class="text-xs font-medium text-slate-600">${escapeHtml(p.budget)}</span>` : ''}
            ${pending > 0 ? `<span class="text-xs text-amber-600">${pending} tarea${pending !== 1 ? 's' : ''} pendiente${pending !== 1 ? 's' : ''}</span>` : ''}
          </div>
          ${tasks.length > 0 ? `
          <div class="mt-2 flex items-center gap-2">
            <div class="flex-1 bg-slate-100 rounded-full h-1">
              <div class="h-1 rounded-full" style="width:${pct}%;background:${cat.color}"></div>
            </div>
            <span class="text-[10px] text-slate-400">${pct}%</span>
          </div>` : ''}
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          <a href="/admin/projects/${p.id}" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors" title="Abrir proyecto">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
          <form method="POST" action="/admin/clientes/${client.id}/unlink-project/${p.id}" onsubmit="return confirm('¿Desvincular este proyecto del cliente?')">
            <button type="submit" class="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors" title="Desvincular">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </form>
        </div>
      </div>
    </div>`;
  }).join('');

  // Try to find matching WA lead by phone
  const waLead = client.phone ? allWa.find(c => c.phone.includes(client.phone.replace(/\D/g, '')) || client.phone.includes(c.phone.replace(/\D/g, ''))) : null;

  const body = `
    <div class="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <nav class="flex items-center gap-1.5 text-sm text-slate-400">
        <a href="/admin/clientes" class="hover:text-blue-600">Clientes</a>
        <span>/</span>
        <span class="text-slate-600 truncate">${escapeHtml(client.name)}</span>
      </nav>
      <div class="flex gap-2 flex-wrap">
        <a href="/admin/clientes/${client.id}/edit" class="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm transition-colors">Editar</a>
        <form method="POST" action="/admin/clientes/${client.id}/delete" onsubmit="return confirm('¿Eliminar este cliente?')">
          <button class="border border-red-200 text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl text-sm transition-colors">Eliminar</button>
        </form>
      </div>
    </div>

    <div class="flex items-center gap-4 mb-6">
      <div class="w-14 h-14 rounded-2xl ${avatarColor} flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
        ${initial}
      </div>
      <div>
        <h1 class="text-2xl font-bold text-slate-900">${escapeHtml(client.name)}</h1>
        <div class="flex items-center gap-2 mt-1">
          ${clientCategoryBadge(client.category)}
          ${client.company ? `<span class="text-sm text-slate-500">${escapeHtml(client.company)}</span>` : ''}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="lg:col-span-2 space-y-5">
        <!-- Projects -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-slate-700">Proyectos (${clientProjects.length})</h2>
            <a href="/admin/projects/new?client_id=${client.id}" class="text-xs text-blue-600 hover:underline">+ Nuevo →</a>
          </div>

          ${clientProjects.length > 0
            ? `<div class="space-y-2 mb-4">${projectCards}</div>`
            : `<div class="text-center py-6 mb-4"><div class="text-2xl mb-2">📋</div><p class="text-sm text-slate-400">Sin proyectos vinculados todavía.</p></div>`}

          <!-- Asignar proyecto existente -->
          ${unlinkableProjects.length > 0 ? `
          <div class="border-t border-slate-100 pt-4">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Asignar proyecto existente</div>
            <form method="POST" action="/admin/clientes/${client.id}/link-project" class="flex gap-2">
              <select name="project_id" required class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0">
                <option value="">Seleccionar proyecto...</option>
                ${unlinkableProjects.map(p => `<option value="${p.id}">${escapeHtml(p.title || p.client_name)}</option>`).join('')}
              </select>
              <button type="submit" class="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">Vincular</button>
            </form>
          </div>` : ''}
        </div>

        <!-- Notes -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-3">Notas</h2>
          <form method="POST" action="/admin/clientes/${client.id}/notes">
            <textarea name="notes" rows="5" placeholder="Historial, acuerdos, notas sobre este cliente..."
              class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500">${escapeHtml(client.notes || '')}</textarea>
            <button class="mt-2 w-full border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 rounded-xl text-sm transition-colors">Guardar notas</button>
          </form>
        </div>
      </div>

      <div class="space-y-5">
        <!-- Contact info -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-4">Contacto</h2>
          <div class="space-y-3">
            ${client.phone ? `<div>
              <div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Teléfono</div>
              <a href="tel:${escapeHtml(client.phone)}" class="text-sm text-blue-600 hover:underline">${escapeHtml(client.phone)}</a>
              ${client.phone ? `<a href="https://wa.me/${client.phone.replace(/\D/g,'')}" target="_blank" class="ml-2 text-xs text-emerald-600 hover:underline">WhatsApp ↗</a>` : ''}
            </div>` : ''}
            ${client.email ? `<div>
              <div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Email</div>
              <a href="mailto:${escapeHtml(client.email)}" class="text-sm text-blue-600 hover:underline truncate block">${escapeHtml(client.email)}</a>
            </div>` : ''}
            ${client.company ? `<div>
              <div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Empresa</div>
              <div class="text-sm text-slate-700">${escapeHtml(client.company)}</div>
            </div>` : ''}
            <div>
              <div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Creado</div>
              <div class="text-sm text-slate-600">${client.created_at ? new Date(client.created_at + (client.created_at.endsWith('Z') ? '' : 'Z')).toLocaleDateString('es-AR', { day:'numeric', month:'short', year:'numeric' }) : '—'}</div>
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-slate-100">
            <a href="/admin/clientes/${client.id}/edit" class="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">✏️ Editar</a>
          </div>
        </div>

        ${waLead ? `
        <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <h2 class="text-xs font-semibold text-emerald-700 mb-2">💬 Lead WA vinculado</h2>
          <p class="text-xs text-emerald-600 mb-2">${escapeHtml(waLead.report?.cliente?.nombre || waLead.phone)}</p>
          <a href="/admin/client/${encodeURIComponent(waLead.phone)}" class="text-xs text-emerald-700 hover:underline font-medium">Ver conversación →</a>
        </div>` : ''}

        <!-- Quick actions -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-3">Acciones rápidas</h2>
          <div class="space-y-2">
            ${client.phone ? `
            <a href="https://wa.me/${client.phone.replace(/\D/g,'')}" target="_blank"
              class="flex items-center gap-2.5 w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors">
              <span>💬</span><span>Abrir WhatsApp</span>
            </a>
            <a href="tel:${escapeHtml(client.phone)}"
              class="flex items-center gap-2.5 w-full border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors">
              <span>📞</span><span>Llamar</span>
            </a>` : ''}
            ${client.email ? `
            <a href="mailto:${escapeHtml(client.email)}"
              class="flex items-center gap-2.5 w-full border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors">
              <span>✉️</span><span>Enviar email</span>
            </a>` : ''}
            <a href="/admin/projects/new?client_id=${client.id}"
              class="flex items-center gap-2.5 w-full border border-blue-200 hover:bg-blue-50 text-blue-600 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors">
              <span>📁</span><span>Crear proyecto</span>
            </a>
          </div>
        </div>

        <!-- Stats -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-3">Resumen</h2>
          <div class="space-y-2.5 text-sm">
            <div class="flex justify-between items-center">
              <span class="text-slate-500">Total proyectos</span>
              <span class="font-semibold text-slate-800">${clientProjects.length}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-500">En curso</span>
              <span class="font-medium text-blue-600">${clientProjects.filter(p => ['in_progress','review'].includes(p.status)).length}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-500">Entregados</span>
              <span class="font-medium text-emerald-600">${clientProjects.filter(p => p.status === 'delivered').length}</span>
            </div>
            ${clientProjects.some(p => p.budget) ? `
            <div class="pt-2 border-t border-slate-100">
              <div class="text-xs text-slate-400 uppercase tracking-wide mb-1.5">Presupuestos</div>
              ${clientProjects.filter(p => p.budget).map(p => `
              <div class="flex justify-between items-center py-0.5">
                <span class="text-xs text-slate-500 truncate mr-2">${escapeHtml(p.title || p.client_name)}</span>
                <span class="text-xs font-semibold text-slate-700 flex-shrink-0">${escapeHtml(p.budget)}</span>
              </div>`).join('')}
            </div>` : ''}
            ${clientProjects.some(p => p.budget_status === 'paid') ? `
            <div class="flex justify-between items-center pt-1">
              <span class="text-slate-500">Proyectos pagados</span>
              <span class="font-medium text-emerald-600">${clientProjects.filter(p => p.budget_status === 'paid').length} ✓</span>
            </div>` : ''}
          </div>
        </div>
      </div>
    </div>`;

  res.send(layout(client.name, body, { pendingCount, activePage: 'clientes', user: req.session?.user }));
});

router.get('/clientes/:id/edit', requireAuth, async (req, res) => {
  const client = await db.getClientRecord(req.params.id);
  if (!client) return res.redirect('/admin/clientes');
  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;
  const body = `
    <div class="mb-5"><a href="/admin/clientes/${client.id}" class="text-sm text-slate-500 hover:text-blue-600">← ${escapeHtml(client.name)}</a></div>
    <h1 class="text-2xl font-bold text-slate-900 mb-6">Editar cliente</h1>
    ${clientForm(client, `/admin/clientes/${client.id}/update`)}`;
  res.send(layout('Editar cliente', body, { pendingCount, activePage: 'clientes', user: req.session?.user }));
});

router.post('/clientes/:id/update', requireAuth, async (req, res) => {
  const { name, company, category, phone, email, notes } = req.body;
  await db.updateClientRecord(req.params.id, { name, company, category, phone, email, notes });
  res.redirect(`/admin/clientes/${req.params.id}`);
});

router.post('/clientes/:id/notes', requireAuth, async (req, res) => {
  await db.updateClientRecord(req.params.id, { ...(await db.getClientRecord(req.params.id) || {}), notes: req.body.notes || '' });
  res.redirect(`/admin/clientes/${req.params.id}`);
});

// Vincular proyecto existente a este cliente
router.post('/clientes/:id/link-project', requireAuth, async (req, res) => {
  const projectId = req.body.project_id;
  if (!projectId) return res.redirect(`/admin/clientes/${req.params.id}`);
  try {
    const project = await db.getProject(projectId);
    if (!project) return res.redirect(`/admin/clientes/${req.params.id}`);
    // tasks ya viene como array de parseProject — updateProject hace el stringify internamente
    await db.updateProject(projectId, { ...project, client_id: req.params.id });
    res.redirect(`/admin/clientes/${req.params.id}`);
  } catch (err) {
    console.error('[link-project] Error:', err);
    res.redirect(`/admin/clientes/${req.params.id}`);
  }
});

// Desvincular proyecto de este cliente
router.post('/clientes/:id/unlink-project/:projectId', requireAuth, async (req, res) => {
  try {
    const project = await db.getProject(req.params.projectId);
    if (project) await db.updateProject(req.params.projectId, { ...project, client_id: '' });
    res.redirect(`/admin/clientes/${req.params.id}`);
  } catch (err) {
    console.error('[unlink-project] Error:', err);
    res.redirect(`/admin/clientes/${req.params.id}`);
  }
});

router.post('/clientes/:id/delete', requireAuth, async (req, res) => {
  await db.deleteClientRecord(req.params.id);
  res.redirect('/admin/clientes');
});

// ─── Documentos (Google Drive-style) ─────────────────────────────────────────

function docLayout(title, sidebarHtml, contentHtml, { pendingCount = 0, user = null } = {}) {
  return layout(title, `
    <div class="flex gap-0 -mx-4 md:-mx-6 -mt-4 md:-mt-6" style="min-height:calc(100vh - 40px)">
      <!-- Left sidebar -->
      <div class="hidden md:flex w-56 flex-shrink-0 border-r border-slate-200 bg-white px-3 py-5 flex-col gap-1" style="min-height:calc(100vh - 40px)">
        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Mi Drive</div>
        ${sidebarHtml}
        <div class="mt-4 pt-4 border-t border-slate-100">
          <details class="group">
            <summary class="list-none">
              <button class="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors cursor-pointer">
                <span class="text-base">➕</span> Nueva carpeta
              </button>
            </summary>
            <div class="mt-2 bg-white border border-slate-200 rounded-xl p-3 shadow-lg">
              <form method="POST" action="/admin/documentos/folder/new" class="space-y-2">
                <input type="text" name="name" placeholder="Nombre..." required autofocus
                  class="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                <input type="text" name="description" placeholder="Descripción (opcional)"
                  class="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                <div class="flex gap-1.5">
                  ${['#3b82f6','#8b5cf6','#10b981','#f59e0b','#f43f5e','#64748b'].map((c,i) =>
                    `<label class="cursor-pointer"><input type="radio" name="color" value="${c}" class="sr-only" ${i===0?'checked':''}><div class="w-5 h-5 rounded-full hover:scale-110 transition-transform" style="background:${c}"></div></label>`).join('')}
                </div>
                <button class="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg text-xs font-semibold transition-colors">Crear</button>
              </form>
            </div>
          </details>
        </div>
      </div>
      <!-- Main content -->
      <div class="flex-1 min-w-0 px-4 md:px-6 py-5 overflow-auto bg-slate-50">
        ${contentHtml}
      </div>
    </div>`, { pendingCount, activePage: 'documentos', user });
}

router.get('/documentos', requireAuth, async (req, res) => {
  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;
  const DATA_DIR = path.join(__dirname, '..', 'data');
  const usedBytes = getDirSize(DATA_DIR);
  const usedMB = (usedBytes / (1024 * 1024)).toFixed(1);
  const usedGB = (usedBytes / (1024 * 1024 * 1024)).toFixed(2);
  const storageLabel = usedBytes > 1024 * 1024 * 1024 ? `${usedGB} GB` : `${usedMB} MB`;
  const folders = await db.listDocumentFolders();
  const projects = await db.listProjects();
  const waClients = await db.listAllClients();
  const type = req.query.type || 'root';
  const folderId = req.query.folder || '';
  const view = req.query.view || 'grid';

  // Build folder data
  const customFolders = folders.map(f => {
    const dir = path.join(DOCUMENTS_DIR, f.id);
    const files = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter(n => !n.startsWith('.')).map(name => {
          const fp = path.join(dir, name);
          const stat = fs.statSync(fp);
          return { name, size: stat.size, mtime: stat.mtime, type: 'custom', folderId: f.id, folderName: f.name };
        })
      : [];
    return { ...f, files, type: 'custom' };
  });

  const projectFolders = projects.map(p => {
    const dir = path.join(PROJECT_FILES_DIR, p.id);
    const files = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter(n => !n.startsWith('.')).map(name => {
          const fp = path.join(dir, name);
          const stat = fs.statSync(fp);
          return { name, size: stat.size, mtime: stat.mtime, type: 'project', folderId: p.id, folderName: p.title || p.client_name };
        })
      : [];
    return { id: p.id, name: p.title || p.client_name, color: '#8b5cf6', description: p.client_name, files, type: 'project' };
  }).filter(f => f.files.length > 0);

  // Demo files
  const DEMOS_BASE = path.join(__dirname, '..', 'data', 'demos');
  const demoFolders = waClients.filter(c => c.demo_status && c.demo_status !== 'none' && c.demo_status !== 'generating').map(c => {
    const slug = (c.phone || '').replace(/[^0-9]/g, '');
    const dir = path.join(DEMOS_BASE, slug);
    let files = [];
    if (fs.existsSync(dir)) {
      // Top-level files
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'versions.json') continue;
        const fp = path.join(dir, entry.name);
        if (entry.isFile()) {
          const stat = fs.statSync(fp);
          files.push({ name: entry.name, size: stat.size, mtime: stat.mtime, type: 'demo', folderId: slug, folderName: c.report?.cliente?.nombre || c.phone, version: 'actual' });
        } else if (entry.isDirectory() && entry.name.match(/^v\d+$/)) {
          // Version directory (v1, v2, etc.)
          const vFiles = fs.readdirSync(fp).filter(n => !n.startsWith('.'));
          for (const vf of vFiles) {
            const vfp = path.join(fp, vf);
            if (fs.statSync(vfp).isFile()) {
              const stat = fs.statSync(vfp);
              files.push({ name: `${entry.name}/${vf}`, size: stat.size, mtime: stat.mtime, type: 'demo', folderId: slug, folderName: c.report?.cliente?.nombre || c.phone, version: entry.name });
            }
          }
        }
      }
    }
    return { id: slug, name: c.report?.cliente?.nombre || c.phone, color: '#0ea5e9', description: 'Demo WA', files, type: 'demo', phone: c.phone };
  }).filter(f => f.files.length > 0);

  const sidebarItem = (href, icon, label, active, color = '') => `
    <a href="${href}" class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}">
      <span style="${color ? `color:${color}` : ''}">${icon}</span>
      <span class="truncate flex-1">${escapeHtml(label)}</span>
    </a>`;

  const activeFolder = type === 'custom' ? customFolders.find(f => f.id === folderId)
    : type === 'project' ? projectFolders.find(f => f.id === folderId)
    : null;

  const sidebarHtml = `
    ${customFolders.length > 0 || true ? `
      <div class="text-[10px] font-semibold text-slate-400 px-2 mt-2 mb-1 uppercase tracking-wider">Mis carpetas</div>
      ${customFolders.map(f => sidebarItem(`/admin/documentos?type=custom&folder=${f.id}&view=${view}`, '📁', f.name, type==='custom'&&folderId===f.id, f.color)).join('')}
      ${customFolders.length === 0 ? '<div class="text-xs text-slate-300 px-2">Sin carpetas</div>' : ''}
    ` : ''}
    ${projectFolders.length > 0 ? `
      <div class="text-[10px] font-semibold text-slate-400 px-2 mt-3 mb-1 uppercase tracking-wider">Proyectos</div>
      ${projectFolders.map(f => sidebarItem(`/admin/documentos?type=project&folder=${f.id}&view=${view}`, '📁', f.name, type==='project'&&folderId===f.id, '#8b5cf6')).join('')}
    ` : ''}
    ${demoFolders.length > 0 ? `
      <div class="text-[10px] font-semibold text-slate-400 px-2 mt-3 mb-1 uppercase tracking-wider">Demos WA</div>
      ${demoFolders.slice(0, 8).map(f => sidebarItem(`/admin/documentos?type=demo&folder=${f.id}&view=${view}`, '💬', f.name, type==='demo'&&folderId===f.id, '#0ea5e9')).join('')}
    ` : ''}`;

  // File icon helper (extended)
  const bigIcon = name => {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const m = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', csv: '📊',
      png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️',
      mp4: '🎬', mov: '🎬', avi: '🎬', mp3: '🎵', wav: '🎵',
      zip: '📦', rar: '📦', html: '🌐', htm: '🌐',
      txt: '📃', md: '📃', js: '⚙️', json: '⚙️' };
    return m[ext] || '📎';
  };

  // Determine files to show
  let currentFiles = [];
  let currentTitle = 'Todos los archivos';
  let currentColor = '#3b82f6';
  let isCustomFolder = false;
  let currentFolderObj = null;

  if (type === 'custom' && folderId) {
    currentFolderObj = customFolders.find(f => f.id === folderId);
    if (currentFolderObj) {
      currentFiles = currentFolderObj.files;
      currentTitle = currentFolderObj.name;
      currentColor = currentFolderObj.color;
      isCustomFolder = true;
    }
  } else if (type === 'project' && folderId) {
    currentFolderObj = projectFolders.find(f => f.id === folderId);
    if (currentFolderObj) {
      currentFiles = currentFolderObj.files;
      currentTitle = currentFolderObj.name;
      currentColor = '#8b5cf6';
    }
  } else if (type === 'demo' && folderId) {
    currentFolderObj = demoFolders.find(f => f.id === folderId);
    if (currentFolderObj) {
      currentFiles = currentFolderObj.files;
      currentTitle = currentFolderObj.name;
      currentColor = '#0ea5e9';
    }
  }

  const totalAll = [...customFolders, ...projectFolders, ...demoFolders].reduce((n, f) => n + f.files.length, 0);

  // File card (grid view)
  const fileCard = (f, downloadHref, deleteAction, canMove) => {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const isImage = ['png','jpg','jpeg','gif','webp'].includes(ext);
    return `
      <div class="bg-white border border-slate-200 rounded-xl p-3 hover:shadow-md hover:border-blue-200 transition-all group flex flex-col gap-2">
        <div class="flex items-start justify-between gap-1">
          <span class="text-3xl leading-none">${bigIcon(f.name)}</span>
          ${f.version && f.version !== 'actual' ? `<span class="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-full font-medium">${f.version}</span>` : ''}
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <a href="${downloadHref}" download class="text-slate-400 hover:text-blue-600 p-1 rounded transition-colors" title="Descargar">⬇</a>
            ${deleteAction ? `
              <form method="POST" action="${deleteAction}" onsubmit="return confirm('¿Eliminar?')" style="display:inline">
                <button class="text-slate-300 hover:text-red-400 p-1 rounded transition-colors" title="Eliminar">✕</button>
              </form>` : ''}
          </div>
        </div>
        <div class="flex-1">
          <div class="text-xs font-medium text-slate-700 break-all leading-tight line-clamp-2" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">${formatBytes(f.size)}</div>
        </div>
        ${canMove && isCustomFolder ? `
          <form method="POST" action="/admin/documentos/file/move" class="pt-1 border-t border-slate-100">
            <input type="hidden" name="filename" value="${escapeHtml(f.name)}">
            <input type="hidden" name="fromFolder" value="${escapeHtml(f.folderId)}">
            <select name="toFolder" onchange="this.form.submit()" class="w-full text-[10px] border-0 bg-transparent text-slate-400 focus:outline-none cursor-pointer">
              <option value="">Mover a...</option>
              ${customFolders.filter(cf => cf.id !== f.folderId).map(cf => `<option value="${cf.id}">${escapeHtml(cf.name)}</option>`).join('')}
            </select>
          </form>` : ''}
      </div>`;
  };

  // File row (list view)
  const fileRow = (f, downloadHref, deleteAction) => `
    <div class="flex items-center gap-3 py-2.5 px-3 hover:bg-slate-50 rounded-xl group transition-colors">
      <span class="text-lg flex-shrink-0">${bigIcon(f.name)}</span>
      <div class="flex-1 min-w-0">
        <div class="text-sm text-slate-700 truncate font-medium">${escapeHtml(f.name)}</div>
        <div class="text-xs text-slate-400">${formatBytes(f.size)} · ${f.mtime ? new Date(f.mtime).toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'}) : ''}</div>
      </div>
      <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <a href="${downloadHref}" download class="text-xs text-blue-600 hover:underline font-medium">⬇ Descargar</a>
        ${deleteAction ? `
          <form method="POST" action="${deleteAction}" onsubmit="return confirm('¿Eliminar?')" style="display:inline">
            <button class="text-xs text-red-400 hover:text-red-600 font-medium">Eliminar</button>
          </form>` : ''}
      </div>
    </div>`;

  // Build content HTML
  let contentHtml = '';

  if (type === 'root') {
    // Overview: show all folder sections
    const allFolderGroups = [
      { label: 'Mis carpetas', folders: customFolders, emptyMsg: 'Sin carpetas todavía. Creá una desde el panel lateral.' },
      { label: 'Proyectos con archivos', folders: projectFolders, emptyMsg: null },
      { label: 'Demos WA', folders: demoFolders, emptyMsg: null },
    ];
    const folderCardHtml = (f) => `
      <a href="/admin/documentos?type=${f.type}&folder=${f.id}&view=${view}"
         class="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer block group">
        <div class="text-3xl mb-2" style="color:${f.color}">📁</div>
        <div class="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-600">${escapeHtml(f.name)}</div>
        <div class="text-xs text-slate-400 mt-0.5">${f.files.length} archivo${f.files.length!==1?'s':''}</div>
        ${f.description && f.description !== f.name ? `<div class="text-[10px] text-slate-300 truncate mt-0.5">${escapeHtml(f.description)}</div>` : ''}
      </a>`;

    contentHtml = `
      <div class="flex items-center justify-between mb-5">
        <div>
          <h1 class="text-xl font-bold text-slate-900">Mi Drive</h1>
          <div class="text-xs text-slate-400 mt-0.5">${totalAll} archivos totales · ${storageLabel} usados</div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="document.getElementById('newFolderInline').classList.toggle('hidden')"
            class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
            + Nueva carpeta
          </button>
          <a href="?view=grid" class="px-2.5 py-2 rounded-xl text-xs font-medium ${view==='grid'?'bg-slate-800 text-white':'text-slate-100 border border-slate-200 hover:bg-slate-50 text-slate-500'}">⊞</a>
          <a href="?view=list" class="px-2.5 py-2 rounded-xl text-xs font-medium ${view==='list'?'bg-slate-800 text-white':'text-slate-100 border border-slate-200 hover:bg-slate-50 text-slate-500'}">≡</a>
        </div>
      </div>
      <!-- Inline new folder form -->
      <div id="newFolderInline" class="hidden bg-white border border-slate-200 rounded-2xl p-5 mb-5 shadow-sm">
        <h3 class="text-sm font-semibold text-slate-700 mb-4">Nueva carpeta</h3>
        <form method="POST" action="/admin/documentos/folder/new" class="flex items-end gap-3 flex-wrap">
          <div class="flex-1 min-w-48">
            <label class="text-xs text-slate-500 block mb-1">Nombre *</label>
            <input type="text" name="name" placeholder="Ej: Contratos, Facturas..." required
              class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div class="flex-1 min-w-36">
            <label class="text-xs text-slate-500 block mb-1">Descripción</label>
            <input type="text" name="description" placeholder="Opcional..."
              class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="text-xs text-slate-500 block mb-1">Color</label>
            <div class="flex gap-1.5 items-center">
              ${['#3b82f6','#8b5cf6','#10b981','#f59e0b','#f43f5e','#64748b'].map((c,i) =>
                `<label class="cursor-pointer"><input type="radio" name="color" value="${c}" class="sr-only" ${i===0?'checked':''}><div class="w-6 h-6 rounded-full hover:scale-110 transition-transform border-2 border-white shadow-sm" style="background:${c}"></div></label>`).join('')}
            </div>
          </div>
          <button class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors">Crear</button>
        </form>
      </div>
      ${allFolderGroups.filter(g => g.folders.length > 0 || g.emptyMsg).map(g => `
        <div class="mb-7">
          <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">${g.label}</div>
          ${g.folders.length > 0
            ? `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">${g.folders.map(folderCardHtml).join('')}</div>`
            : g.emptyMsg ? `<p class="text-xs text-slate-400">${g.emptyMsg}</p>` : ''}
        </div>`).join('')}`;
  } else if (currentFolderObj) {
    // Inside a folder — show files
    const getDownloadHref = f => {
      if (f.type === 'custom') return `/admin/documentos/folder/${f.folderId}/file/${encodeURIComponent(f.name)}/download`;
      if (f.type === 'project') return `/admin/documentos/project/${f.folderId}/file/${encodeURIComponent(f.name)}/download`;
      if (f.type === 'demo') return `/admin/documentos/demo/${f.folderId}/file/${encodeURIComponent(f.name)}/download`;
      return '#';
    };
    const getDeleteAction = f => {
      if (f.type === 'custom') return `/admin/documentos/folder/${f.folderId}/file/${encodeURIComponent(f.name)}/delete`;
      if (f.type === 'project') return `/admin/projects/${f.folderId}/files/${encodeURIComponent(f.name)}/delete`;
      return null; // demos can't be deleted from here
    };

    const uploadSection = (type === 'custom' || type === 'demo') ? `
      <form method="POST" action="/admin/documentos/${type === 'demo' ? 'demo' : 'folder'}/${folderId}/upload" enctype="multipart/form-data" class="mt-5">
        <label class="flex items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl py-5 px-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
          <span class="text-2xl">📎</span>
          <div>
            <div class="text-sm font-medium text-slate-600">Subir archivos</div>
            <div class="text-xs text-slate-400">PDF, imágenes, docs, videos · Máx. 50MB</div>
          </div>
          <input type="file" name="files" multiple class="hidden" onchange="this.form.submit()">
        </label>
      </form>` : (type === 'project') ? `
      <div class="mt-5 text-center">
        <a href="/admin/projects/${folderId}" class="text-sm text-blue-600 hover:underline">Ver proyecto completo para subir archivos →</a>
      </div>` : '';

    const deleteSection = (type === 'custom') ? `
      <form method="POST" action="/admin/documentos/folder/${folderId}/delete" onsubmit="return confirm('¿Eliminar esta carpeta y todos sus archivos?')" class="ml-auto">
        <button class="text-xs border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">Eliminar carpeta</button>
      </form>` : '';

    contentHtml = `
      <div class="flex items-center gap-3 mb-5">
        <a href="/admin/documentos" class="text-sm text-slate-400 hover:text-blue-600">← Mi Drive</a>
        <span class="text-slate-200">/</span>
        <span class="text-sm font-semibold text-slate-700">${escapeHtml(currentTitle)}</span>
        <div class="flex items-center gap-2 ml-auto">
          <a href="?type=${type}&folder=${folderId}&view=grid" class="px-2.5 py-1.5 rounded-lg text-xs font-medium ${view==='grid'?'bg-slate-800 text-white':'text-slate-500 hover:bg-slate-100'}">⊞</a>
          <a href="?type=${type}&folder=${folderId}&view=list" class="px-2.5 py-1.5 rounded-lg text-xs font-medium ${view==='list'?'bg-slate-800 text-white':'text-slate-500 hover:bg-slate-100'}">≡</a>
          ${deleteSection}
        </div>
      </div>
      ${(() => {
        // For demo folders, group by version (actual first, then newest versions)
        const sortedFiles = type === 'demo'
          ? [...currentFiles].sort((a, b) => {
              if (a.version === 'actual' && b.version !== 'actual') return -1;
              if (a.version !== 'actual' && b.version === 'actual') return 1;
              return (b.version || '').localeCompare(a.version || '');
            })
          : currentFiles;
        return sortedFiles.length === 0
          ? `<div class="text-center py-20"><div class="text-5xl mb-3">📂</div><p class="text-sm text-slate-400">Sin archivos. Subí el primero.</p></div>`
          : view === 'grid'
            ? `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                ${sortedFiles.map(f => fileCard(f, getDownloadHref(f), getDeleteAction(f), true)).join('')}
               </div>`
            : `<div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                ${sortedFiles.map(f => fileRow(f, getDownloadHref(f), getDeleteAction(f))).join('')}
               </div>`;
      })()}
      ${uploadSection}`;
  }

  const storageBarWidth = Math.min(Math.round((usedBytes / (1 * 1024 * 1024 * 1024)) * 100), 95);
  const sidebarHtmlFull = sidebarHtml + `
  <div style="margin-top:auto;padding-top:16px;border-top:1px solid #f1f5f9;padding-left:8px;padding-right:8px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <span style="font-size:10px;color:#94a3b8;font-weight:500">Almacenamiento</span>
      <span style="font-size:10px;color:#64748b;font-weight:600">${storageLabel}</span>
    </div>
    <div style="background:#f1f5f9;border-radius:9999px;height:5px;width:100%">
      <div style="height:5px;border-radius:9999px;background:linear-gradient(to right,#60a5fa,#6366f1);width:${storageBarWidth}%"></div>
    </div>
    <div style="font-size:10px;color:#cbd5e1;margin-top:4px">${storageLabel} de ~1 GB · Railway Volume</div>
  </div>`;

  res.send(docLayout('Documentos', sidebarHtmlFull, contentHtml, { pendingCount, user: req.session?.user }));
});

router.post('/documentos/folder/new', requireAuth, async (req, res) => {
  const { name, color, description } = req.body;
  if (!name?.trim()) return res.redirect('/admin/documentos');
  const id = await db.createDocumentFolder({ name: name.trim(), color: color || '#3b82f6', description: description || '' });
  fs.mkdirSync(path.join(DOCUMENTS_DIR, id), { recursive: true });
  res.redirect(`/admin/documentos?type=custom&folder=${id}`);
});

// Download routes
router.get('/documentos/folder/:folderId/file/:filename/download', requireAuth, (req, res) => {
  const filePath = safePath(DOCUMENTS_DIR, req.params.folderId, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Archivo no encontrado');
  res.download(filePath, req.params.filename);
});

router.get('/documentos/project/:projectId/file/:filename/download', requireAuth, (req, res) => {
  const filePath = safePath(PROJECT_FILES_DIR, req.params.projectId, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Archivo no encontrado');
  res.download(filePath, req.params.filename);
});

router.get('/documentos/demo/:slug/file/:filename/download', requireAuth, (req, res) => {
  const DEMOS_BASE = path.join(__dirname, '..', 'data', 'demos');
  const filename = decodeURIComponent(req.params.filename);
  // Handle version paths like "v1/landing.html"
  const filePath = safePath(DEMOS_BASE, req.params.slug, ...filename.split('/'));
  if (!fs.existsSync(filePath)) return res.status(404).send('Archivo no encontrado');
  res.download(filePath, filename.split('/').pop());
});

// View (not download) for custom folder files
router.get('/documentos/folder/:folderId/file/:filename', requireAuth, (req, res) => {
  const filePath = safePath(DOCUMENTS_DIR, req.params.folderId, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Archivo no encontrado');
  res.sendFile(filePath);
});

// Upload to custom folder
router.post('/documentos/folder/:folderId/upload', requireAuth, (req, res) => {
  uploadDoc.array('files', 20)(req, res, err => {
    if (err) console.error('[doc upload]', err.message);
    res.redirect(`/admin/documentos?type=custom&folder=${req.params.folderId}`);
  });
});

// Upload to demo folder
router.post('/documentos/demo/:slug/upload', requireAuth, (req, res) => {
  const DEMOS_BASE = path.join(__dirname, '..', 'data', 'demos');
  const destDir = path.join(DEMOS_BASE, req.params.slug);
  fs.mkdirSync(destDir, { recursive: true });

  const demoUpload = multer({
    storage: multer.diskStorage({
      destination: (r, f, cb) => cb(null, destDir),
      filename: (r, file, cb) => cb(null, file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')),
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  demoUpload.array('files', 20)(req, res, err => {
    if (err) console.error('[demo upload]', err.message);
    res.redirect(`/admin/documentos?type=demo&folder=${req.params.slug}`);
  });
});

// Delete file from custom folder
router.post('/documentos/folder/:folderId/file/:filename/delete', requireAuth, (req, res) => {
  const filePath = safePath(DOCUMENTS_DIR, req.params.folderId, req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.redirect(`/admin/documentos?type=custom&folder=${req.params.folderId}`);
});

// Delete entire custom folder
router.post('/documentos/folder/:folderId/delete', requireAuth, async (req, res) => {
  const dir = safePath(DOCUMENTS_DIR, req.params.folderId);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  await db.deleteDocumentFolder(req.params.folderId);
  res.redirect('/admin/documentos');
});

// Move file between custom folders
router.post('/documentos/file/move', requireAuth, (req, res) => {
  const { filename, fromFolder, toFolder } = req.body;
  if (!filename || !fromFolder || !toFolder) return res.redirect('/admin/documentos');
  const src = safePath(DOCUMENTS_DIR, fromFolder, filename);
  const destDir = safePath(DOCUMENTS_DIR, toFolder);
  const dest = safePath(destDir, filename);
  if (fs.existsSync(src)) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.renameSync(src, dest);
  }
  res.redirect(`/admin/documentos?type=custom&folder=${toFolder}`);
});

// ─── Demo seed: simula un lead completo para probar el flujo ─────────────────

router.post('/create-demo-lead', requireAuth, async (req, res) => {
  const tipo = req.body.tipo || 'web';

  const DEMOS = {
    web: {
      phone: 'whatsapp:+5493878000001',
      report: {
        cliente: { nombre: 'Panadería El Hornito', telefono: '+5493878000001', email: 'hornito@demo.com', contacto_extra: '' },
        proyecto: {
          tipo: 'Página web para panadería',
          descripcion: 'Página web para mostrar productos, horarios, hacer pedidos por WhatsApp y tener presencia online. El negocio está en el centro de Salta.',
          funcionalidades: ['Galería de productos con fotos', 'Horarios de atención', 'Botón de pedido por WhatsApp', 'Mapa de ubicación', 'Sección de promociones'],
          plataforma: 'web',
          estado_actual: 'Solo tienen Instagram',
        },
        requisitos: { plazo: '3 semanas', presupuesto: '$80.000 ARS', urgencia: 'media', stack_sugerido: '', notas_adicionales: 'Quieren colores cálidos, que se vea artesanal' },
        resumen_ejecutivo: 'Panadería familiar en el centro de Salta que necesita página web para mostrar sus productos y recibir pedidos por WhatsApp. Parten de cero, solo tienen Instagram.',
      },
    },
    bot: {
      phone: 'whatsapp:+5493878000002',
      report: {
        cliente: { nombre: 'Veterinaria PetCare', telefono: '+5493878000002', email: 'petcare@demo.com', contacto_extra: '' },
        proyecto: {
          tipo: 'Bot de WhatsApp para veterinaria',
          descripcion: 'Bot de WhatsApp que responda consultas frecuentes, gestione turnos automáticamente y avise cuando está listo el turno.',
          funcionalidades: ['Agendar turnos automáticamente', 'Consultas de precios y servicios', 'Recordatorio de turno por WhatsApp', 'Historial de mascotas', 'Derivar a atención humana si es urgente'],
          plataforma: 'whatsapp',
          estado_actual: 'Atienden todo manualmente por WhatsApp',
        },
        requisitos: { plazo: '4 semanas', presupuesto: '$120.000 ARS', urgencia: 'alta', stack_sugerido: '', notas_adicionales: 'Mucho volumen en diciembre, necesitan automatizar antes de fin de año' },
        resumen_ejecutivo: 'Veterinaria con alto volumen de consultas que necesita un bot de WhatsApp para automatizar turnos y consultas frecuentes.',
      },
    },
    app: {
      phone: 'whatsapp:+5493878000003',
      report: {
        cliente: { nombre: 'Gimnasio FitMax', telefono: '+5493878000003', email: 'fitmax@demo.com', contacto_extra: '' },
        proyecto: {
          tipo: 'App móvil para gimnasio',
          descripcion: 'App para que los socios del gimnasio vean clases, reserven lugares, paguen su cuota y controlen su asistencia desde el celular.',
          funcionalidades: ['Ver calendario de clases', 'Reservar lugar en clases', 'Pago de cuota online', 'Control de asistencia', 'Notificaciones de clases nuevas'],
          plataforma: 'app móvil (iOS/Android)',
          estado_actual: 'Todo manual en papel y WhatsApp',
        },
        requisitos: { plazo: '2 meses', presupuesto: '$300.000 ARS', urgencia: 'media', stack_sugerido: 'Flutter + Firebase', notas_adicionales: 'Colores negro y naranja flúo' },
        resumen_ejecutivo: 'Gimnasio en Salta que quiere digitalizar toda la gestión de socios con una app mobile completa.',
      },
    },
  };

  const demo = DEMOS[tipo] || DEMOS.web;

  // Crear o resetear el lead de demo en la DB
  await db.upsertConversation(demo.phone, {
    history: [
      { role: 'user', content: 'Hola, me interesa hacer un proyecto digital' },
      { role: 'assistant', content: '¡Hola! Soy el asistente de David. Contame qué necesitás.' },
      { role: 'user', content: `Necesito ${demo.report.proyecto.tipo.toLowerCase()} para mi negocio` },
      { role: 'assistant', content: 'Perfecto, te entiendo. Armé un resumen de lo que me contaste...' },
    ],
    stage: 'done',
    context: { nombre: demo.report.cliente.nombre },
    report: demo.report,
  });
  await db.updateClientStage(demo.phone, 'qualified');
  await db.appendTimelineEvent(demo.phone, { event: 'report_generated', note: 'Lead de demo creado manualmente' });

  // Disparar generación de demos
  orchestrator.processNewReport(demo.phone, demo.report).catch(console.error);

  res.redirect(`/admin/client/${encodeURIComponent(demo.phone)}`);
});

// ─── Finanzas ───────────────────────────────────────────────────────────────

router.get('/finanzas', requireAuth, async (req, res) => {
  const [clients, projects] = await Promise.all([
    db.listAllClients(),
    db.listProjects(),
  ]);

  // ── Costos mensuales de infraestructura ──
  const totalMonthlyCost = SERVICES.reduce((s, sv) => s + sv.monthly, 0);

  // ── Uso estimado de APIs basado en datos reales ──
  const totalConversations = clients.length;
  const totalMessages = clients.reduce((s, c) => {
    const hist = c.history || [];
    return s + hist.length;
  }, 0);
  const demosGenerated = clients.filter(c => c.demo_status && !['none','generating'].includes(c.demo_status)).length;
  const reportsGenerated = clients.filter(c => c.report).length;

  // Calcular costos estimados de API
  function estimateCost(opKey, count) {
    const est = TOKEN_ESTIMATES[opKey];
    if (!est) return 0;
    const pricing = API_PRICING[est.model];
    if (!pricing) return 0;
    if (est.model === 'groq-whisper') {
      return (est.input * count / 60) * pricing.input; // minutos a horas
    }
    const inputCost = (est.input * count / 1000000) * pricing.input;
    const outputCost = (est.output * count / 1000000) * pricing.output;
    return inputCost + outputCost;
  }

  const apiUsage = [
    { label: 'Mensajes de conversación', count: totalMessages, cost: estimateCost('conversation_msg', totalMessages), model: 'Claude Haiku 4.5' },
    { label: 'Reportes generados', count: reportsGenerated, cost: estimateCost('report_generation', reportsGenerated), model: 'Claude Haiku 4.5' },
    { label: 'Demos landing page', count: demosGenerated, cost: estimateCost('landing_demo', demosGenerated), model: 'Claude Sonnet 4' },
    { label: 'Mockups WhatsApp', count: demosGenerated, cost: estimateCost('whatsapp_mockup', demosGenerated), model: 'Claude Haiku 4.5' },
  ];
  const totalApiCost = apiUsage.reduce((s, u) => s + u.cost, 0);

  // ── Pipeline de ingresos ──
  const parseBudget = b => parseFloat(String(b || '0').replace(/[^0-9.]/g, '')) || 0;
  const withBudget = projects.filter(p => parseBudget(p.budget) > 0);
  const revenue = {
    total: withBudget.reduce((s, p) => s + parseBudget(p.budget), 0),
    paid: withBudget.filter(p => p.budget_status === 'paid').reduce((s, p) => s + parseBudget(p.budget), 0),
    approved: withBudget.filter(p => ['approved','partial','paid'].includes(p.budget_status)).reduce((s, p) => s + parseBudget(p.budget), 0),
    pending: withBudget.filter(p => ['not_quoted','quoted'].includes(p.budget_status)).reduce((s, p) => s + parseBudget(p.budget), 0),
    partial: withBudget.filter(p => p.budget_status === 'partial').reduce((s, p) => s + parseBudget(p.budget), 0),
  };

  const fmtMoney = n => {
    if (n >= 1000) return '$' + (n/1000).toFixed(n%1000===0?0:1) + 'K';
    if (n >= 1) return '$' + n.toFixed(0);
    if (n > 0) return '$' + n.toFixed(4);
    return '$0';
  };

  // ── Costo por lead/proyecto ──
  const costPerLead = totalConversations > 0 ? totalApiCost / totalConversations : 0;
  const costPerDemo = demosGenerated > 0 ? (estimateCost('landing_demo', demosGenerated) + estimateCost('whatsapp_mockup', demosGenerated)) / demosGenerated : 0;

  // ── Proyección mensual ──
  const daysActive = (() => {
    if (clients.length === 0) return 1;
    const oldest = clients.reduce((min, c) => {
      const d = new Date(c.created_at);
      return d < min ? d : min;
    }, new Date());
    return Math.max(1, Math.ceil((Date.now() - oldest.getTime()) / 86400000));
  })();
  const dailyRate = totalApiCost / daysActive;
  const projectedMonthlyApi = dailyRate * 30;

  const body = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-slate-900">Finanzas</h1>
        <p class="text-sm text-slate-400 mt-1">Costos, ingresos y estimaciones del proyecto</p>
      </div>
      <a href="/admin/presupuesto" class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
        🧮 Nueva cotización
      </a>
    </div>

    <!-- Saldos actuales editables -->
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5">
      <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 class="text-sm font-semibold text-slate-700">Saldos actuales</h2>
          <p class="text-[10px] text-slate-400">Actualiza manualmente desde cada consola</p>
        </div>
        <button onclick="saveBalances()" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors font-medium">Guardar</button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        <div class="px-5 py-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm">🤖</span>
            <span class="text-xs font-semibold text-slate-600">Anthropic</span>
            <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener" class="text-[10px] text-blue-500 hover:underline ml-auto">Consola →</a>
          </div>
          <div class="flex items-baseline gap-1 mb-1">
            <span class="text-[10px] text-slate-400">Saldo:</span>
            <span class="text-[10px] text-slate-400">$</span>
            <input id="bal-anthropic" type="number" step="0.01" min="0" value="4.36" class="w-20 text-lg font-bold text-slate-800 border-0 border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-500 bg-transparent" oninput="updateBalanceBar('anthropic')">
            <span class="text-xs text-slate-400">/ $5.00 USD</span>
          </div>
          <div class="h-1.5 bg-slate-100 rounded-full mt-2">
            <div id="bar-anthropic" class="h-full rounded-full bg-emerald-500 transition-all" style="width:87%"></div>
          </div>
          <div id="pct-anthropic" class="text-[10px] text-slate-400 mt-1">87% usado · expira Apr 2027</div>
        </div>
        <div class="px-5 py-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm">⚡</span>
            <span class="text-xs font-semibold text-slate-600">Groq</span>
            <a href="https://console.groq.com/usage" target="_blank" rel="noopener" class="text-[10px] text-blue-500 hover:underline ml-auto">Consola →</a>
          </div>
          <div class="flex items-baseline gap-1 mb-1">
            <span class="text-[10px] text-slate-400">Gastado:</span>
            <span class="text-[10px] text-slate-400">$</span>
            <input id="bal-groq" type="number" step="0.01" min="0" value="0.01" class="w-20 text-lg font-bold text-slate-800 border-0 border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-500 bg-transparent" oninput="updateBalanceBar('groq')">
            <span class="text-xs text-slate-400">USD (free tier)</span>
          </div>
          <div class="h-1.5 bg-slate-100 rounded-full mt-2">
            <div id="bar-groq" class="h-full rounded-full bg-emerald-500 transition-all" style="width:0%"></div>
          </div>
          <div id="pct-groq" class="text-[10px] text-slate-400 mt-1">Sin cargo · whisper-large-v3</div>
        </div>
        <div class="px-5 py-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm">📧</span>
            <span class="text-xs font-semibold text-slate-600">Resend</span>
            <a href="https://resend.com/settings/usage" target="_blank" rel="noopener" class="text-[10px] text-blue-500 hover:underline ml-auto">Consola →</a>
          </div>
          <div class="flex items-baseline gap-1 mb-1">
            <span class="text-[10px] text-slate-400">Emails:</span>
            <input id="bal-resend-used" type="number" step="1" min="0" value="16" class="w-14 text-lg font-bold text-slate-800 border-0 border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-500 bg-transparent" oninput="updateBalanceBar('resend')">
            <span class="text-xs text-slate-400">/</span>
            <input id="bal-resend-total" type="number" step="1" min="1" value="3000" class="w-16 text-sm font-medium text-slate-500 border-0 border-b border-dashed border-slate-200 focus:outline-none focus:border-blue-500 bg-transparent" oninput="updateBalanceBar('resend')">
            <span class="text-xs text-slate-400">mes</span>
          </div>
          <div class="h-1.5 bg-slate-100 rounded-full mt-2">
            <div id="bar-resend" class="h-full rounded-full bg-emerald-500 transition-all" style="width:1%"></div>
          </div>
          <div id="pct-resend" class="text-[10px] text-slate-400 mt-1">0.5% del límite mensual</div>
        </div>
      </div>
    </div>

    <!-- Resumen rápido -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white">
        <div class="text-xs opacity-75 uppercase tracking-wide">Ingresos pipeline</div>
        <div class="text-2xl font-bold mt-1">${fmtMoney(revenue.total)}</div>
        <div class="text-xs opacity-60 mt-0.5">${withBudget.length} proyectos</div>
      </div>
      <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
        <div class="text-xs opacity-75 uppercase tracking-wide">Cobrado</div>
        <div class="text-2xl font-bold mt-1">${fmtMoney(revenue.paid)}</div>
        <div class="text-xs opacity-60 mt-0.5">${revenue.total > 0 ? Math.round(revenue.paid/revenue.total*100) : 0}% del pipeline</div>
      </div>
      <div class="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 text-white">
        <div class="text-xs opacity-75 uppercase tracking-wide">Costo API total</div>
        <div class="text-2xl font-bold mt-1">${fmtMoney(totalApiCost)}</div>
        <div class="text-xs opacity-60 mt-0.5">~${fmtMoney(projectedMonthlyApi)}/mes proy.</div>
      </div>
      <div class="bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl p-4 text-white">
        <div class="text-xs opacity-75 uppercase tracking-wide">Infra mensual</div>
        <div class="text-2xl font-bold mt-1">${fmtMoney(totalMonthlyCost)}</div>
        <div class="text-xs opacity-60 mt-0.5">${SERVICES.filter(s => s.monthly > 0).length} servicios pagos</div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

      <!-- Costos de servicios -->
      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100">
          <h2 class="text-sm font-semibold text-slate-700">Servicios e infraestructura</h2>
          <p class="text-[11px] text-slate-400 mt-0.5">Costos mensuales fijos</p>
        </div>
        <div class="divide-y divide-slate-100">
          ${SERVICES.map(sv => `
            <div class="px-5 py-3 flex items-center gap-3">
              <span class="text-base flex-shrink-0">${sv.icon}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-slate-700">${sv.name}</div>
                <div class="text-[10px] text-slate-400">${sv.notes}</div>
              </div>
              <div class="text-right flex-shrink-0">
                <div class="text-sm font-bold ${sv.monthly > 0 ? 'text-amber-600' : 'text-emerald-600'}">${sv.monthly > 0 ? '$'+sv.monthly : 'Gratis'}</div>
                <div class="text-[10px] text-slate-400">${sv.unit}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <span class="text-sm font-semibold text-slate-700">Total mensual</span>
          <span class="text-lg font-bold text-slate-900">${fmtMoney(totalMonthlyCost)}</span>
        </div>
      </div>

      <!-- Consumo de APIs -->
      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100">
          <h2 class="text-sm font-semibold text-slate-700">Consumo de APIs (Anthropic + Groq)</h2>
          <p class="text-[11px] text-slate-400 mt-0.5">Estimado según uso real · ${daysActive} dias activo${daysActive > 1 ? 's' : ''}</p>
        </div>
        <div class="divide-y divide-slate-100">
          ${apiUsage.map(u => `
            <div class="px-5 py-3 flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <div class="text-sm text-slate-700">${u.label}</div>
                <div class="text-[10px] text-slate-400">${u.model}</div>
              </div>
              <div class="text-center flex-shrink-0 px-3">
                <div class="text-sm font-bold text-slate-800">${u.count}</div>
                <div class="text-[10px] text-slate-400">usos</div>
              </div>
              <div class="text-right flex-shrink-0 w-16">
                <div class="text-sm font-bold ${u.cost > 0.01 ? 'text-amber-600' : 'text-emerald-600'}">${u.cost > 0 ? '$'+u.cost.toFixed(4) : '$0'}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="px-5 py-3 bg-slate-50 border-t border-slate-200">
          <div class="flex justify-between items-center">
            <span class="text-sm font-semibold text-slate-700">Total gastado en APIs</span>
            <span class="text-lg font-bold text-amber-600">${fmtMoney(totalApiCost)}</span>
          </div>
          <div class="flex justify-between items-center mt-1">
            <span class="text-[11px] text-slate-400">Proyección mensual (30 días)</span>
            <span class="text-sm font-semibold text-slate-600">~${fmtMoney(projectedMonthlyApi)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- KPIs de costo -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      <div class="bg-white rounded-xl border border-slate-200 px-4 py-3 text-center">
        <div class="text-lg font-bold text-slate-800">${costPerLead > 0 ? '$'+costPerLead.toFixed(4) : '—'}</div>
        <div class="text-[10px] text-slate-400 uppercase tracking-wide">Costo por lead</div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 px-4 py-3 text-center">
        <div class="text-lg font-bold text-slate-800">${costPerDemo > 0 ? '$'+costPerDemo.toFixed(4) : '—'}</div>
        <div class="text-[10px] text-slate-400 uppercase tracking-wide">Costo por demo</div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 px-4 py-3 text-center">
        <div class="text-lg font-bold text-slate-800">${totalConversations}</div>
        <div class="text-[10px] text-slate-400 uppercase tracking-wide">Leads totales</div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 px-4 py-3 text-center">
        <div class="text-lg font-bold text-slate-800">${demosGenerated}</div>
        <div class="text-[10px] text-slate-400 uppercase tracking-wide">Demos generados</div>
      </div>
    </div>

    <!-- Monitoreo y alertas -->
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5">
      <div class="px-5 py-4 border-b border-slate-100">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-semibold text-slate-700">Monitoreo de uso y alertas</h2>
            <p class="text-[11px] text-slate-400 mt-0.5">Define presupuestos mensuales y recibe alertas visuales</p>
          </div>
          <span class="px-2 py-1 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">Auto-tracking</span>
        </div>
      </div>
      <div class="px-5 py-4">
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <div class="flex items-start gap-2">
            <span class="text-sm mt-0.5">ℹ️</span>
            <div class="text-xs text-blue-700 leading-relaxed">
              <strong>Tracking local:</strong> los costos se estiman segun operaciones registradas en la base de datos (mensajes, reportes, demos).
              Para datos de balance y consumo exacto, accede a los dashboards:
              <div class="flex flex-wrap gap-2 mt-2">
                <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener" class="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors font-medium">
                  <span>🤖</span> Anthropic Console
                </a>
                <a href="https://console.groq.com/usage" target="_blank" rel="noopener" class="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors font-medium">
                  <span>⚡</span> Groq Dashboard
                </a>
                <a href="https://resend.com/settings/usage" target="_blank" rel="noopener" class="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors font-medium">
                  <span>📧</span> Resend Usage
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Budget trackers -->
        <div class="space-y-4" id="budgetTrackers">
          ${[
            { key: 'anthropic', label: 'Anthropic (Claude)', icon: '🤖', estimated: totalApiCost - estimateCost('landing_demo', demosGenerated) > 0 ? totalApiCost - estimateCost('landing_demo', demosGenerated) : totalApiCost, defaultBudget: 10 },
            { key: 'groq', label: 'Groq (Whisper)', icon: '⚡', estimated: 0, defaultBudget: 5 },
            { key: 'infra', label: 'Infraestructura', icon: '🏗️', estimated: totalMonthlyCost, defaultBudget: 10 },
          ].map(tracker => {
            const pct = tracker.defaultBudget > 0 ? Math.min(100, Math.round(tracker.estimated / tracker.defaultBudget * 100)) : 0;
            const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
            const alertBadge = pct >= 90
              ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 animate-pulse">ALERTA</span>'
              : pct >= 70
              ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">ATENCION</span>'
              : '<span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">OK</span>';
            return `
            <div class="border border-slate-200 rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="text-base">${tracker.icon}</span>
                  <span class="text-sm font-medium text-slate-700">${tracker.label}</span>
                </div>
                <div class="flex items-center gap-2">
                  ${alertBadge}
                  <div class="flex items-center gap-1">
                    <span class="text-xs text-slate-500">Presupuesto:</span>
                    <input type="number" class="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs text-right budget-input"
                           data-key="${tracker.key}" value="${tracker.defaultBudget}" min="0" step="1"
                           onchange="updateBudgetTracker(this)">
                    <span class="text-xs text-slate-400">USD</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div class="${barColor} h-full rounded-full transition-all" style="width:${pct}%"></div>
                </div>
                <span class="text-xs font-bold text-slate-600 w-24 text-right">$${tracker.estimated.toFixed(2)} / $${tracker.defaultBudget}</span>
              </div>
              <div class="text-[10px] text-slate-400 mt-1">${pct}% del presupuesto mensual estimado</div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="px-5 py-3 bg-slate-50 border-t border-slate-200">
        <div class="text-[10px] text-slate-400">Los presupuestos se guardan en tu navegador. Las estimaciones se actualizan con cada operacion registrada en el sistema.</div>
      </div>
    </div>

    <!-- Precios de referencia de APIs -->
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5">
      <div class="px-5 py-4 border-b border-slate-100">
        <h2 class="text-sm font-semibold text-slate-700">Precios de referencia — APIs</h2>
        <p class="text-[11px] text-slate-400 mt-0.5">Precios actuales por modelo para calcular costos</p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-slate-50 text-left">
              <th class="px-5 py-2 text-[10px] font-semibold text-slate-500 uppercase">Modelo</th>
              <th class="px-5 py-2 text-[10px] font-semibold text-slate-500 uppercase">Input</th>
              <th class="px-5 py-2 text-[10px] font-semibold text-slate-500 uppercase">Output</th>
              <th class="px-5 py-2 text-[10px] font-semibold text-slate-500 uppercase">Se usa para</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${Object.entries(API_PRICING).map(([key, p]) => `
              <tr>
                <td class="px-5 py-2.5 font-medium text-slate-700">${p.name}</td>
                <td class="px-5 py-2.5 text-slate-600">${p.unit ? p.unit : '$'+p.input.toFixed(2)+'/1M tok'}</td>
                <td class="px-5 py-2.5 text-slate-600">${p.output > 0 ? '$'+p.output.toFixed(2)+'/1M tok' : '—'}</td>
                <td class="px-5 py-2.5 text-slate-400 text-xs">${p.uses}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pipeline de ingresos por proyecto -->
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5">
      <div class="px-5 py-4 border-b border-slate-100">
        <h2 class="text-sm font-semibold text-slate-700">Pipeline de ingresos por proyecto</h2>
      </div>
      ${withBudget.length > 0 ? `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-slate-50 text-left">
              <th class="px-5 py-2 text-[10px] font-semibold text-slate-500 uppercase">Proyecto</th>
              <th class="px-5 py-2 text-[10px] font-semibold text-slate-500 uppercase">Cliente</th>
              <th class="px-5 py-2 text-[10px] font-semibold text-slate-500 uppercase">Presupuesto</th>
              <th class="px-5 py-2 text-[10px] font-semibold text-slate-500 uppercase">Estado pago</th>
              <th class="px-5 py-2 text-[10px] font-semibold text-slate-500 uppercase">Estado proyecto</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${projects.filter(p => parseBudget(p.budget) > 0).map(p => `
              <tr class="hover:bg-slate-50 cursor-pointer" onclick="location.href='/admin/projects/${p.id}'">
                <td class="px-5 py-2.5 font-medium text-slate-700">${escapeHtml(p.title || '—')}</td>
                <td class="px-5 py-2.5 text-slate-500">${escapeHtml(p.client_name)}</td>
                <td class="px-5 py-2.5 font-bold text-slate-800">$${parseBudget(p.budget).toLocaleString()}</td>
                <td class="px-5 py-2.5">${budgetStatusBadge(p.budget_status)}</td>
                <td class="px-5 py-2.5">${projectStatusBadge(p.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="px-5 py-3 bg-slate-50 border-t border-slate-200">
        <div class="flex flex-wrap gap-4">
          <div><span class="text-xs text-slate-400">Pipeline total:</span> <span class="text-sm font-bold text-slate-800">${fmtMoney(revenue.total)}</span></div>
          <div><span class="text-xs text-slate-400">Cobrado:</span> <span class="text-sm font-bold text-emerald-600">${fmtMoney(revenue.paid)}</span></div>
          <div><span class="text-xs text-slate-400">Aprobado:</span> <span class="text-sm font-bold text-blue-600">${fmtMoney(revenue.approved)}</span></div>
          <div><span class="text-xs text-slate-400">Pendiente:</span> <span class="text-sm font-bold text-amber-600">${fmtMoney(revenue.pending)}</span></div>
        </div>
      </div>` : `
      <div class="px-5 py-8 text-center">
        <div class="text-2xl mb-2">💰</div>
        <div class="text-sm text-slate-400">Sin proyectos con presupuesto definido</div>
        <a href="/admin/projects" class="text-xs text-blue-600 hover:underline mt-1 block">Agregar presupuesto a un proyecto →</a>
      </div>`}
    </div>

    <!-- Banner → módulo de presupuestos -->
    <div class="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-5 flex items-center justify-between">
      <div>
        <div class="text-sm font-semibold text-blue-800">Calculadora de presupuestos</div>
        <div class="text-xs text-blue-600 mt-0.5">Usá el módulo dedicado para crear y guardar presupuestos con todos los detalles.</div>
      </div>
      <a href="/admin/presupuesto" class="flex-shrink-0 ml-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">Ir a Presupuestos →</a>
    </div>

    <script>
    // Balance cards persistence & bars
    function updateBalanceBar(key){
      if(key==='anthropic'){
        var val=parseFloat(document.getElementById('bal-anthropic').value)||0;
        var total=5.00;
        var pct=Math.min(100,Math.round((1-val/total)*100));
        document.getElementById('bar-anthropic').style.width=pct+'%';
        document.getElementById('bar-anthropic').className='h-full rounded-full transition-all '+(pct>=90?'bg-red-500':pct>=70?'bg-amber-500':'bg-emerald-500');
        document.getElementById('pct-anthropic').textContent=pct+'% usado · expira Apr 2027';
      }else if(key==='groq'){
        var val=parseFloat(document.getElementById('bal-groq').value)||0;
        document.getElementById('bar-groq').style.width=Math.min(100,val*100)+'%';
        document.getElementById('pct-groq').textContent='$'+val.toFixed(2)+' USD gastado · whisper-large-v3';
      }else if(key==='resend'){
        var used=parseInt(document.getElementById('bal-resend-used').value)||0;
        var total=parseInt(document.getElementById('bal-resend-total').value)||3000;
        var pct=Math.min(100,Math.round(used/total*100));
        document.getElementById('bar-resend').style.width=pct+'%';
        document.getElementById('bar-resend').className='h-full rounded-full transition-all '+(pct>=90?'bg-red-500':pct>=70?'bg-amber-500':'bg-emerald-500');
        document.getElementById('pct-resend').textContent=pct+'% del límite mensual';
      }
    }
    function saveBalances(){
      localStorage.setItem('dt-bal-anthropic',document.getElementById('bal-anthropic').value);
      localStorage.setItem('dt-bal-groq',document.getElementById('bal-groq').value);
      localStorage.setItem('dt-bal-resend-used',document.getElementById('bal-resend-used').value);
      localStorage.setItem('dt-bal-resend-total',document.getElementById('bal-resend-total').value);
      if(typeof showToast==='function')showToast('Saldos guardados');
    }
    (function initBalances(){
      var a=localStorage.getItem('dt-bal-anthropic');if(a){document.getElementById('bal-anthropic').value=a;}
      var g=localStorage.getItem('dt-bal-groq');if(g){document.getElementById('bal-groq').value=g;}
      var ru=localStorage.getItem('dt-bal-resend-used');if(ru){document.getElementById('bal-resend-used').value=ru;}
      var rt=localStorage.getItem('dt-bal-resend-total');if(rt){document.getElementById('bal-resend-total').value=rt;}
      updateBalanceBar('anthropic');updateBalanceBar('groq');updateBalanceBar('resend');
    })();

    // Budget tracker persistence
    function initBudgetTrackers(){
      document.querySelectorAll('.budget-input').forEach(function(input){
        var saved = localStorage.getItem('dt-budget-' + input.dataset.key);
        if(saved) input.value = saved;
      });
    }
    function updateBudgetTracker(input){
      localStorage.setItem('dt-budget-' + input.dataset.key, input.value);
    }
    initBudgetTrackers();
    </script>`;

  res.send(layout('Finanzas', body, { activePage: 'finanzas', user: req.session?.user }));
});

// ─── Presupuestos ────────────────────────────────────────────────────────────

router.get('/presupuesto', requireAuth, async (req, res) => {
  const projects = await db.listProjects();
  const projectsJson = JSON.stringify(projects.map(p => ({
    id: p.id,
    title: p.title || p.client_name,
    client: p.client_name,
    category: p.category,
    budget: p.budget,
    description: p.scope || p.notes || '',
  })));

  const body = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-slate-900">Calculadora de Presupuestos</h1>
        <p class="text-sm text-slate-400 mt-1">Cotizá proyectos en ARS y USD con detalle completo para el cliente</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="toggleHistory()" class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-sm font-medium transition-colors">
          🕐 Historial
        </button>
        <button onclick="printQuote()" class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-sm font-medium transition-colors">
          🖨️ Imprimir
        </button>
        <button onclick="saveQuote()" class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          💾 Guardar
        </button>
      </div>
    </div>

    <!-- Historial -->
    <div id="history-panel" class="hidden mb-4">
      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <span class="text-sm font-semibold text-slate-700">🕐 Historial de cotizaciones</span>
          <button onclick="clearHistory()" class="text-xs text-red-400 hover:text-red-600 transition-colors">Limpiar todo</button>
        </div>
        <div id="history-list" class="divide-y divide-slate-100 max-h-64 overflow-y-auto">
          <div class="px-5 py-4 text-xs text-slate-400 text-center">Sin historial guardado</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-5 gap-5">

      <!-- LEFT: Form -->
      <div class="xl:col-span-3 space-y-4">

        <!-- Configuración de tarifas -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button onclick="toggleSection('cfg')" class="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div class="flex items-center gap-2">
              <span class="text-sm">⚙️</span>
              <span class="text-sm font-semibold text-slate-700">Configuración de tarifas</span>
            </div>
            <span id="cfg-arrow" class="text-slate-400 text-xs transition-transform">▼</span>
          </button>
          <div id="cfg-body" class="px-5 pb-5 border-t border-slate-100">
            <!-- Client type toggle -->
            <div class="flex items-center gap-3 pt-4 mb-4">
              <span class="text-[10px] font-bold text-slate-500 uppercase flex-shrink-0">Tipo de cliente:</span>
              <div class="flex gap-1">
                <button id="ct-ars" onclick="setClientType('ARS')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white transition-colors">🇦🇷 ARS</button>
                <button id="ct-usd" onclick="setClientType('USD')" class="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">🌍 USD</button>
              </div>
              <span id="ct-badge" class="text-[10px] text-slate-400">Cotizando en pesos · usa tarifa ARS</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de cambio</label>
                <div class="flex items-center gap-1">
                  <span class="text-[10px] text-slate-400">$1=</span>
                  <input id="cfg-rate" type="number" value="1000" min="1" step="10" class="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" oninput="autoSaveCfg();calcUpdate()">
                  <span class="text-[10px] text-slate-400">ARS</span>
                </div>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">🇦🇷 Tarifa ARS/hora</label>
                <div class="flex items-center gap-1">
                  <span class="text-[10px] text-slate-400">$</span>
                  <input id="cfg-hourly-ars" type="number" value="25000" min="1" step="500" class="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" oninput="autoSaveCfg();calcUpdate()">
                </div>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">🌍 Tarifa USD/hora</label>
                <div class="flex items-center gap-1">
                  <span class="text-[10px] text-slate-400">$</span>
                  <input id="cfg-hourly-usd" type="number" value="25" min="1" step="1" class="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" oninput="autoSaveCfg();calcUpdate()">
                </div>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Margen</label>
                <div class="flex items-center gap-1">
                  <input id="cfg-margin" type="number" value="40" min="0" max="200" step="5" class="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" oninput="autoSaveCfg();calcUpdate()">
                  <span class="text-[10px] text-slate-400">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Datos del proyecto -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div class="px-5 py-3 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <span class="text-sm">📋</span>
              <span class="text-sm font-semibold text-slate-700">Datos del proyecto</span>
            </div>
          </div>
          <div class="px-5 py-4 space-y-3">
            <div class="flex items-center gap-2">
              <select id="proj-load" class="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600" onchange="loadProject()">
                <option value="">— Cargar desde proyecto existente —</option>
                ${projects.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title || p.client_name)} — ${escapeHtml(p.client_name)}</option>`).join('')}
              </select>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre del proyecto</label>
                <input id="proj-name" type="text" placeholder="Ej: Tienda Online Ropa Nordeste" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" oninput="calcUpdate()">
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cliente</label>
                <input id="proj-client" type="text" placeholder="Nombre del cliente" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de proyecto</label>
              <select id="proj-type" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" onchange="onTypeChange()">
                <option value="web">Página web / Landing page</option>
                <option value="ecommerce">E-commerce / Tienda online</option>
                <option value="app">App web completa</option>
                <option value="bot">Bot WhatsApp / Automatización</option>
                <option value="design">Diseño y branding</option>
                <option value="maintenance">Mantenimiento / Soporte</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descripción / alcance</label>
              <textarea id="proj-desc" rows="2" placeholder="Describí brevemente el alcance del proyecto..." class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" oninput="calcUpdate()"></textarea>
            </div>
          </div>
        </div>

        <!-- Mano de obra -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-sm">👷</span>
              <span class="text-sm font-semibold text-slate-700">Mano de obra</span>
            </div>
            <button onclick="addLaborRow()" class="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Agregar ítem</button>
          </div>
          <div class="px-5 py-3">
            <datalist id="labor-concepts">
              <option value="Diseño UI/UX">
              <option value="Diseño gráfico">
              <option value="Desarrollo Frontend">
              <option value="Desarrollo Backend">
              <option value="Desarrollo fullstack">
              <option value="Testing y QA">
              <option value="Deploy y configuración">
              <option value="Capacitación y onboarding">
              <option value="Reuniones y coordinación">
              <option value="Documentación técnica">
              <option value="SEO / Optimización">
              <option value="Soporte técnico">
              <option value="Integración de APIs">
              <option value="Base de datos y migraciones">
            </datalist>
            <div class="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase mb-1.5 px-1">
              <div class="col-span-5">Concepto</div>
              <div class="col-span-2">Horas</div>
              <div class="col-span-3">Tarifa/h (USD)</div>
              <div class="col-span-1"></div>
            </div>
            <div id="labor-rows" class="space-y-2"></div>
          </div>
          <div class="px-5 py-2 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
            <span class="text-xs text-slate-500">Total horas: <span id="total-hours" class="font-bold text-slate-700">0</span></span>
            <span class="text-xs text-slate-500">Subtotal labor: <span id="labor-subtotal" class="font-bold text-slate-700">$0</span></span>
          </div>
        </div>

        <!-- Servicios y gastos -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-sm">🔧</span>
              <span class="text-sm font-semibold text-slate-700">Servicios y gastos</span>
            </div>
            <button onclick="addCustomService()" class="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Personalizado</button>
          </div>
          <div id="services-list" class="px-5 py-3 space-y-1.5"></div>
          <div id="custom-services" class="px-5 pb-3 space-y-2"></div>
          <div class="px-5 py-2 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
            <span class="text-xs text-slate-500">Subtotal servicios:</span>
            <span id="services-subtotal" class="text-xs font-bold text-slate-700">$0</span>
          </div>
        </div>

        <!-- Mantenimiento -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div class="px-5 py-3 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <span class="text-sm">🔄</span>
              <span class="text-sm font-semibold text-slate-700">Mantenimiento mensual</span>
            </div>
          </div>
          <div class="px-5 py-4">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2" id="maint-options">
              ${[
                { key: '0', label: 'Sin mantenimiento', sub: '', usd: 0 },
                { key: '30', label: 'Básico', sub: 'Actualizaciones, backups', usd: 30 },
                { key: '60', label: 'Estándar', sub: 'Soporte, cambios menores', usd: 60 },
                { key: '120', label: 'Premium', sub: 'Soporte 24h, mejoras', usd: 120 },
              ].map((opt, i) => `
                <label class="flex flex-col gap-1 border-2 ${i===0?'border-blue-500 bg-blue-50':'border-slate-200'} rounded-xl p-3 cursor-pointer hover:border-blue-300 transition-colors maint-opt" data-key="${opt.key}" onclick="selectMaint('${opt.key}',this)">
                  <div class="flex items-center gap-2">
                    <div class="w-3.5 h-3.5 rounded-full border-2 ${i===0?'border-blue-500 bg-blue-500':'border-slate-300'} flex-shrink-0 maint-radio"></div>
                    <span class="text-xs font-semibold text-slate-700">${opt.label}</span>
                  </div>
                  ${opt.usd > 0 ? `<div class="text-xs font-bold text-blue-600 ml-5">$${opt.usd} USD/mes</div>` : '<div class="text-xs text-slate-400 ml-5">—</div>'}
                  ${opt.sub ? `<div class="text-[10px] text-slate-400 ml-5">${opt.sub}</div>` : ''}
                </label>
              `).join('')}
            </div>
            <div id="maint-rec" class="mt-3 px-3 py-2.5 rounded-xl text-xs border hidden"></div>
          </div>
        </div>

        <!-- Guardar en proyecto -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div class="px-5 py-3 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <span class="text-sm">📎</span>
              <span class="text-sm font-semibold text-slate-700">Asociar a proyecto / cliente</span>
            </div>
          </div>
          <div class="px-5 py-4 space-y-3">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Proyecto al que pertenece este presupuesto</label>
              <select id="quote-project-link" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600">
                <option value="">— Sin asociar —</option>
                ${projects.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title || p.client_name)} — ${escapeHtml(p.client_name)}</option>`).join('')}
              </select>
            </div>
            <div class="flex gap-2">
              <button onclick="saveToProject()" class="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
                💾 Guardar en documentos del proyecto
              </button>
              <button onclick="printQuote()" class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
                🖨️ PDF
              </button>
            </div>
            <div id="save-status" class="hidden text-xs text-center py-1 rounded-lg"></div>
          </div>
        </div>

      </div>

      <!-- RIGHT: Results -->
      <div class="xl:col-span-2 space-y-4">

        <!-- Resumen de costos (interno) -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-4">
          <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <span class="text-sm font-semibold text-slate-700">Resumen</span>
            <div class="flex items-center gap-1 text-[10px]">
              <button id="btn-ars" onclick="setCurrency('ARS')" class="px-2 py-1 rounded-lg bg-blue-600 text-white font-bold transition-colors">ARS</button>
              <button id="btn-usd" onclick="setCurrency('USD')" class="px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 font-bold transition-colors">USD</button>
            </div>
          </div>
          <div class="px-5 py-4 space-y-2.5">
            <div class="flex justify-between items-center">
              <span class="text-xs text-slate-500">Mano de obra</span>
              <div class="text-right">
                <div id="r-labor" class="text-sm font-bold text-slate-800">$0</div>
                <div id="r-labor-alt" class="text-[10px] text-slate-400">$0 USD</div>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-slate-500">Servicios (total)</span>
              <div class="text-right">
                <div id="r-services" class="text-sm font-bold text-slate-800">$0</div>
                <div id="r-services-alt" class="text-[10px] text-slate-400">$0 USD</div>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-slate-500">Mantenimiento (anual)</span>
              <div class="text-right">
                <div id="r-maint" class="text-sm font-bold text-slate-800">—</div>
                <div id="r-maint-alt" class="text-[10px] text-slate-400"></div>
              </div>
            </div>
            <div class="border-t border-slate-100 pt-2">
              <div class="flex justify-between items-center">
                <span class="text-xs text-slate-500">Costo total</span>
                <div id="r-total-cost" class="text-sm font-bold text-slate-800">$0</div>
              </div>
              <div class="flex justify-between items-center mt-1">
                <span class="text-xs text-slate-500">Margen (<span id="r-margin-pct">40</span>%)</span>
                <div id="r-margin" class="text-xs font-medium text-emerald-600">$0</div>
              </div>
            </div>
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 text-white">
              <div class="text-[10px] uppercase opacity-70 tracking-wide">Precio para el cliente</div>
              <div id="r-client-price" class="text-2xl font-bold mt-1">$0</div>
              <div id="r-client-price-alt" class="text-xs opacity-70 mt-0.5">$0 USD</div>
              <div class="mt-2 pt-2 border-t border-white/20 text-[10px] opacity-70">
                Mantenimiento: <span id="r-monthly">—</span>/mes
              </div>
            </div>
          </div>
          <div class="px-5 pb-4">
            <button onclick="toggleClientView()" class="w-full py-2.5 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 rounded-xl text-sm font-semibold transition-colors">
              📄 Ver presupuesto para cliente
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- Vista para el cliente (colapsable) -->
    <div id="client-view" class="hidden mt-5">
      <div class="bg-white rounded-xl border-2 border-blue-200 overflow-hidden" id="printable-quote">
        <div class="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6 text-white">
          <div class="flex items-start justify-between">
            <div>
              <div class="text-xs uppercase tracking-widest opacity-70 mb-1">Propuesta comercial</div>
              <h2 id="cv-title" class="text-xl font-bold">Proyecto</h2>
              <div id="cv-client" class="text-sm opacity-80 mt-1"></div>
            </div>
            <div class="text-right">
              <div class="text-xs opacity-70">DT Systems</div>
              <div class="text-xs opacity-70">David Taranto</div>
              <div id="cv-date" class="text-xs opacity-70 mt-1"></div>
            </div>
          </div>
        </div>
        <div class="px-8 py-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Alcance del proyecto</h3>
              <p id="cv-desc" class="text-sm text-slate-600 leading-relaxed">—</p>

              <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 mt-6">Inversión</h3>
              <div id="cv-breakdown" class="space-y-2"></div>
              <div class="mt-4 pt-4 border-t-2 border-slate-200">
                <div class="flex justify-between items-center">
                  <span class="text-sm font-bold text-slate-700">Inversión inicial</span>
                  <span id="cv-total" class="text-lg font-bold text-blue-700">$0</span>
                </div>
                <div id="cv-monthly-row" class="flex justify-between items-center mt-1 hidden">
                  <span class="text-xs text-slate-500">Mantenimiento mensual</span>
                  <span id="cv-monthly" class="text-sm font-bold text-blue-600">$0/mes</span>
                </div>
              </div>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Qué incluye</h3>
              <ul id="cv-benefits" class="space-y-2"></ul>

              <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 mt-6">Oportunidades</h3>
              <ul id="cv-opportunities" class="space-y-2"></ul>

              <div id="cv-custom-benefits" class="mt-4">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xs font-bold text-slate-500 uppercase">Agregar beneficio/oportunidad</span>
                </div>
                <div class="flex gap-2">
                  <input id="new-benefit" type="text" placeholder="Ej: Soporte técnico por 6 meses" class="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs">
                  <select id="new-benefit-type" class="px-2 py-2 border border-slate-200 rounded-lg text-xs">
                    <option value="benefit">Beneficio ✅</option>
                    <option value="opportunity">Oportunidad 📈</option>
                  </select>
                  <button onclick="addBenefit()" class="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">+</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="px-8 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between no-print">
          <span class="text-xs text-slate-400">Este presupuesto tiene validez de 30 días</span>
          <button onclick="printQuote()" class="text-sm text-blue-600 hover:underline font-medium">🖨️ Imprimir / Guardar PDF</button>
        </div>
      </div>
    </div>

    <style>
    @media print {
      body > *:not(#printable-wrap) { display: none !important; }
      .no-print { display: none !important; }
      #printable-quote { border: none !important; box-shadow: none !important; }
      #sidebar, #main-wrapper > :not(#printable-wrap), .fab-btn { display: none !important; }
    }
    </style>

    <script>
    var PROJECTS_DATA = ${projectsJson};
    var primaryCurrency = 'ARS';
    var maintUSD = 0;
    var customBenefits = [];
    var customOpportunities = [];
    var laborRowId = 0;
    var customServiceId = 0;

    var SERVICES_PRESETS = [
      { key:'hosting',    label:'Hosting (Railway)',         icon:'🚂', usd:5,    type:'monthly', months:12, checked:true,  note:'$5/mes × 12 meses = $60/año' },
      { key:'domain_ar',  label:'Dominio .com.ar',           icon:'🌐', usd:4,    type:'annual',  months:1,  checked:true,  note:'$4/año aprox' },
      { key:'domain_com', label:'Dominio .com',              icon:'🌍', usd:12,   type:'annual',  months:1,  checked:false, note:'$12/año aprox' },
      { key:'ssl',        label:'Certificado SSL',           icon:'🔒', usd:0,    type:'annual',  months:1,  checked:true,  note:'Incluido en Railway' },
      { key:'whatsapp',   label:'Meta WhatsApp API',         icon:'💬', usd:0,    type:'monthly', months:12, checked:false, note:'Free tier: 1000 conv/mes' },
      { key:'claude',     label:'API Claude (Anthropic)',    icon:'🤖', usd:10,   type:'monthly', months:12, checked:false, note:'~$10/mes estimado' },
      { key:'email',      label:'Email transaccional',       icon:'📧', usd:0,    type:'monthly', months:12, checked:false, note:'Free tier Resend' },
      { key:'gdrive',     label:'Google Drive (storage)',    icon:'☁️', usd:0,    type:'monthly', months:12, checked:false, note:'15GB gratis' },
      { key:'mercadopago',label:'MercadoPago (pagos)',       icon:'💳', usd:0,    type:'monthly', months:12, checked:false, note:'Sin costo fijo, comisión por venta' },
      { key:'maps',       label:'Google Maps API',           icon:'🗺️', usd:0,    type:'monthly', months:12, checked:false, note:'Free tier: 200 USD/mes de crédito' },
    ];

    var BENEFITS_BY_TYPE = {
      web: [
        'Sitio web profesional accesible 24/7',
        'Diseño adaptado a celular y tablet (responsive)',
        'Optimizado para buscadores (SEO básico)',
        'Dominio y hosting gestionados',
        'Formulario de contacto funcional',
        'Panel de administración de contenidos',
      ],
      ecommerce: [
        'Tienda online operativa desde el día 1',
        'Carrito de compras y checkout integrado',
        'Sistema de pagos con MercadoPago',
        'Catálogo de productos administrable',
        'Notificaciones automáticas al comprador',
        'Panel de gestión de pedidos y stock',
      ],
      bot: [
        'Bot activo las 24 horas del día, 7 días a la semana',
        'Respuestas automáticas a preguntas frecuentes',
        'Captura de leads sin intervención manual',
        'Reportes y métricas de conversaciones',
        'Integración con tu sistema de gestión',
        'Transcripción de audios automática',
      ],
      app: [
        'Aplicación web accesible desde cualquier dispositivo',
        'Panel de administración personalizado',
        'Sistema de usuarios y niveles de acceso',
        'Backups automáticos de datos',
        'Integración con APIs y servicios externos',
        'Soporte técnico en período de garantía',
      ],
      design: [
        'Identidad visual coherente y profesional',
        'Manual de marca con paleta de colores y tipografías',
        'Formatos para redes sociales y materiales impresos',
        'Logo en alta resolución (SVG, PNG, PDF)',
        'Adaptaciones para uso digital y físico',
      ],
      maintenance: [
        'Actualizaciones periódicas de seguridad',
        'Monitoreo de disponibilidad del sitio',
        'Respaldo diario de datos',
        'Soporte técnico por consultas',
        'Informe mensual de métricas',
      ],
      custom: [
        'Solución a medida según necesidades específicas',
        'Documentación técnica del proyecto',
        'Capacitación para el equipo del cliente',
      ],
    };

    var OPPORTUNITIES_BY_TYPE = {
      web: [
        'Captación de nuevos clientes las 24h sin esfuerzo',
        'Mayor credibilidad y profesionalismo frente a la competencia',
        'Posicionamiento en Google para búsquedas locales',
        'Generación de consultas automáticas',
      ],
      ecommerce: [
        'Ventas automáticas sin depender de horarios ni personal',
        'Expansión del negocio a nivel regional o nacional',
        'Datos reales de qué productos venden más',
        'Reducción de costos operativos de atención',
      ],
      bot: [
        'Atención al cliente escalable sin costo adicional de personal',
        'Seguimiento automático de leads que no cerraron',
        'Tiempo libre para enfocarse en clientes de mayor valor',
        'Datos de las preguntas más frecuentes para mejorar el negocio',
      ],
      app: [
        'Automatización de procesos internos que hoy son manuales',
        'Acceso a datos en tiempo real desde cualquier lugar',
        'Escalabilidad: crecer sin cambiar de plataforma',
        'Reducción de errores humanos en la gestión',
      ],
      design: [
        'Primera impresión profesional que genera confianza inmediata',
        'Consistencia visual en todos los puntos de contacto',
        'Diferenciación clara frente a la competencia',
      ],
      maintenance: [
        'Tranquilidad de tener el sitio siempre actualizado',
        'Prevención de caídas y pérdida de clientes',
        'Mejoras continuas sin tener que contratar de cero',
      ],
      custom: [
        'Solución adaptada exactamente al flujo de trabajo actual',
        'Independencia tecnológica y control total del sistema',
      ],
    };

    var clientType = 'ARS'; // 'ARS' | 'USD'

    function getRate(){ return parseFloat(document.getElementById('cfg-rate').value)||1000; }
    function getHourly(){
      var rate=getRate();
      if(clientType==='USD') return parseFloat(document.getElementById('cfg-hourly-usd').value)||25;
      return (parseFloat(document.getElementById('cfg-hourly-ars').value)||25000)/rate;
    }
    function getMargin(){ return parseFloat(document.getElementById('cfg-margin').value)||40; }

    function setClientType(type){
      clientType=type;
      document.getElementById('ct-ars').className='px-3 py-1.5 rounded-lg text-xs font-bold transition-colors '+(type==='ARS'?'bg-blue-600 text-white':'text-slate-500 hover:bg-slate-100');
      document.getElementById('ct-usd').className='px-3 py-1.5 rounded-lg text-xs font-bold transition-colors '+(type==='USD'?'bg-blue-600 text-white':'text-slate-500 hover:bg-slate-100');
      document.getElementById('ct-badge').textContent=type==='ARS'?'Cotizando en pesos · usa tarifa ARS':'Cotizando en dólares · usa tarifa USD';
      autoSaveCfg();
      calcUpdate();
    }

    function autoSaveCfg(){
      localStorage.setItem('dt-cfg-rate',document.getElementById('cfg-rate').value);
      localStorage.setItem('dt-cfg-hourly-ars',document.getElementById('cfg-hourly-ars').value);
      localStorage.setItem('dt-cfg-hourly-usd',document.getElementById('cfg-hourly-usd').value);
      localStorage.setItem('dt-cfg-margin',document.getElementById('cfg-margin').value);
      localStorage.setItem('dt-cfg-clienttype',clientType);
    }
    function loadCfg(){
      var r=localStorage.getItem('dt-cfg-rate');if(r)document.getElementById('cfg-rate').value=r;
      var ha=localStorage.getItem('dt-cfg-hourly-ars');if(ha)document.getElementById('cfg-hourly-ars').value=ha;
      var hu=localStorage.getItem('dt-cfg-hourly-usd');if(hu)document.getElementById('cfg-hourly-usd').value=hu;
      var m=localStorage.getItem('dt-cfg-margin');if(m)document.getElementById('cfg-margin').value=m;
      var ct=localStorage.getItem('dt-cfg-clienttype');if(ct)clientType=ct;
    }

    var SERVICES_BY_TYPE = {
      web:         ['hosting','domain_ar','ssl'],
      ecommerce:   ['hosting','domain_ar','ssl','mercadopago'],
      app:         ['hosting','domain_ar','ssl','email','gdrive'],
      bot:         ['hosting','whatsapp','claude','ssl'],
      design:      [],
      maintenance: ['hosting'],
      custom:      ['hosting','ssl'],
    };

    var MAINT_REC = {
      web:         { level:'30',  msg:'Recomendado: Básico — actualizaciones de seguridad y contenidos', color:'bg-amber-50 border-amber-200 text-amber-800' },
      ecommerce:   { level:'60',  msg:'Recomendado: Estándar — las tiendas requieren updates y soporte de pagos', color:'bg-amber-50 border-amber-200 text-amber-800' },
      app:         { level:'60',  msg:'Recomendado: Estándar — apps requieren soporte y mejoras periódicas', color:'bg-amber-50 border-amber-200 text-amber-800' },
      bot:         { level:'120', msg:'Recomendado: Premium — los bots requieren monitoreo y ajustes continuos', color:'bg-red-50 border-red-200 text-red-800' },
      design:      { level:'0',   msg:'Sin mantenimiento requerido en general', color:'bg-emerald-50 border-emerald-200 text-emerald-800' },
      maintenance: { level:'60',  msg:'Ya es un proyecto de mantenimiento — el costo mensual es el servicio en sí', color:'bg-blue-50 border-blue-200 text-blue-800' },
      custom:      { level:'30',  msg:'Evaluá si el proyecto requiere actualizaciones periódicas', color:'bg-slate-50 border-slate-200 text-slate-600' },
    };

    function applyServicesByType(type){
      var toCheck=SERVICES_BY_TYPE[type]||[];
      Object.keys(servicesState).forEach(k=>{ servicesState[k].checked=toCheck.includes(k); });
      renderServices();
      calcUpdate();
    }

    function updateMaintRec(type){
      var rec=MAINT_REC[type];
      var el=document.getElementById('maint-rec');
      if(!rec||!el)return;
      el.className='mt-3 px-3 py-2.5 rounded-xl text-xs border '+rec.color;
      el.textContent='💡 '+rec.msg;
      el.classList.remove('hidden');
    }

    function fmtARS(usd){ return '$'+(usd*getRate()).toLocaleString('es-AR',{maximumFractionDigits:0})+' ARS'; }
    function fmtUSD(usd){ return '$'+usd.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' USD'; }
    function fmt(usd){ return primaryCurrency==='ARS'?fmtARS(usd):fmtUSD(usd); }
    function fmtAlt(usd){ return primaryCurrency==='ARS'?fmtUSD(usd):fmtARS(usd); }

    function setCurrency(c){
      primaryCurrency=c;
      document.getElementById('btn-ars').className='px-2 py-1 rounded-lg font-bold transition-colors '+(c==='ARS'?'bg-blue-600 text-white':'text-slate-500 hover:bg-slate-100');
      document.getElementById('btn-usd').className='px-2 py-1 rounded-lg font-bold transition-colors '+(c==='USD'?'bg-blue-600 text-white':'text-slate-500 hover:bg-slate-100');
      calcUpdate();
    }

    function toggleSection(id){
      var body=document.getElementById(id+'-body');
      var arrow=document.getElementById(id+'-arrow');
      body.classList.toggle('hidden');
      arrow.style.transform=body.classList.contains('hidden')?'rotate(-90deg)':'';
    }

    // Labor rows
    var laborRows = [];
    function initLaborRows(rows){
      laborRows=rows||[
        {id:++laborRowId,concept:'Diseño UI/UX',hours:8,rate:null},
        {id:++laborRowId,concept:'Desarrollo',hours:24,rate:null},
        {id:++laborRowId,concept:'Testing y QA',hours:4,rate:null},
      ];
      renderLaborRows();
    }
    function addLaborRow(){
      laborRows.push({id:++laborRowId,concept:'',hours:8,rate:null});
      renderLaborRows();
    }
    function removeLaborRow(id){
      laborRows=laborRows.filter(r=>r.id!==id);
      renderLaborRows();
    }
    function renderLaborRows(){
      var html=laborRows.map(r=>\`
        <div class="grid grid-cols-12 gap-2 items-center" id="lr-\${r.id}">
          <div class="col-span-5">
            <input type="text" value="\${escVal(r.concept)}" list="labor-concepts" placeholder="Buscar concepto..." class="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs" oninput="updateLaborRow(\${r.id},'concept',this.value)">
          </div>
          <div class="col-span-2">
            <input type="number" value="\${r.hours}" min="0" step="0.5" class="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-center" oninput="updateLaborRow(\${r.id},'hours',parseFloat(this.value)||0)">
          </div>
          <div class="col-span-3">
            <input type="number" value="\${r.rate||''}" placeholder="base" min="0" step="1" class="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-center" oninput="updateLaborRow(\${r.id},'rate',this.value?parseFloat(this.value):null)">
          </div>
          <div class="col-span-2 text-right">
            <span class="text-[10px] text-slate-400 mr-1" id="lr-cost-\${r.id}"></span>
            <button onclick="removeLaborRow(\${r.id})" class="text-slate-300 hover:text-red-400 transition-colors text-xs">✕</button>
          </div>
        </div>
      \`).join('');
      document.getElementById('labor-rows').innerHTML=html;
      calcUpdate();
    }
    function updateLaborRow(id,field,val){
      var r=laborRows.find(x=>x.id===id);
      if(r)r[field]=val;
      calcUpdate();
    }

    // Services
    var servicesState = {};
    function initServices(){
      SERVICES_PRESETS.forEach(s=>{ servicesState[s.key]={...s}; });
      renderServices();
    }
    function renderServices(){
      var html=SERVICES_PRESETS.map(s=>{
        var st=servicesState[s.key];
        return \`<div class="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
          <input type="checkbox" id="svc-\${s.key}" \${st.checked?'checked':''} class="w-4 h-4 rounded text-blue-600" onchange="toggleService('\${s.key}',this.checked)">
          <label for="svc-\${s.key}" class="flex-1 flex items-center gap-2 cursor-pointer">
            <span class="text-sm">\${s.icon}</span>
            <span class="text-xs text-slate-700">\${s.label}</span>
            <span class="text-[10px] text-slate-400 ml-auto">\${s.note}</span>
          </label>
          <input type="number" value="\${st.usd}" min="0" step="1" class="w-14 px-1.5 py-1 border border-slate-200 rounded-lg text-xs text-center" oninput="updateServiceCost('\${s.key}',parseFloat(this.value)||0)" title="USD">
          \${s.type==='monthly'?\`<select class="px-1 py-1 border border-slate-200 rounded-lg text-[10px]" onchange="updateServiceMonths('\${s.key}',parseInt(this.value))"><option value="1" \${st.months===1?'selected':''}>1m</option><option value="3" \${st.months===3?'selected':''}>3m</option><option value="6" \${st.months===6?'selected':''}>6m</option><option value="12" \${st.months===12?'selected':''}>12m</option></select>\`:'<span class="w-10 text-[10px] text-slate-400 text-center">anual</span>'}
          <span class="text-[10px] font-bold text-slate-600 w-12 text-right">\${st.checked?'$'+(st.usd*(s.type==='monthly'?st.months:1)).toFixed(0):'—'}</span>
        </div>\`;
      }).join('');
      document.getElementById('services-list').innerHTML=html;
    }
    function toggleService(key,val){servicesState[key].checked=val;renderServices();calcUpdate();}
    function updateServiceCost(key,val){servicesState[key].usd=val;renderServices();calcUpdate();}
    function updateServiceMonths(key,val){servicesState[key].months=val;renderServices();calcUpdate();}

    // Custom services
    var customServices = [];
    function addCustomService(){
      customServiceId++;
      var id='cs'+customServiceId;
      var div=document.createElement('div');
      div.id=id;
      div.className='flex items-center gap-2';
      div.innerHTML=\`<input type="text" placeholder="Descripción" class="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs">
        <span class="text-[10px] text-slate-400">$</span>
        <input type="number" value="0" min="0" step="1" class="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-center" oninput="calcUpdate()" title="USD">
        <button onclick="document.getElementById('\${id}').remove();calcUpdate()" class="text-slate-300 hover:text-red-400 text-xs">✕</button>\`;
      document.getElementById('custom-services').appendChild(div);
      div.querySelectorAll('input')[0].addEventListener('input',()=>calcUpdate());
    }

    // Maintenance
    function selectMaint(key, el){
      maintUSD=parseFloat(key)||0;
      document.querySelectorAll('.maint-opt').forEach(e=>{
        e.classList.remove('border-blue-500','bg-blue-50');
        e.classList.add('border-slate-200');
        e.querySelector('.maint-radio').className='w-3.5 h-3.5 rounded-full border-2 border-slate-300 flex-shrink-0 maint-radio';
      });
      el.classList.add('border-blue-500','bg-blue-50');
      el.classList.remove('border-slate-200');
      el.querySelector('.maint-radio').className='w-3.5 h-3.5 rounded-full border-2 border-blue-500 bg-blue-500 flex-shrink-0 maint-radio';
      calcUpdate();
    }

    // Main calculation
    function calcUpdate(){
      var hourly=getHourly();
      // Labor
      var totalHours=0,laborCostUSD=0;
      laborRows.forEach(r=>{
        var rate=r.rate||hourly;
        var cost=r.hours*rate;
        totalHours+=r.hours;
        laborCostUSD+=cost;
        var el=document.getElementById('lr-cost-'+r.id);
        if(el)el.textContent='$'+cost.toFixed(0);
      });
      document.getElementById('total-hours').textContent=totalHours.toFixed(1);
      document.getElementById('labor-subtotal').textContent=fmtUSD(laborCostUSD);

      // Services
      var servicesCostUSD=Object.values(servicesState).reduce((s,v)=>{
        if(!v.checked)return s;
        return s+v.usd*(v.type==='monthly'?v.months:1);
      },0);
      // Custom services
      document.querySelectorAll('#custom-services > div').forEach(d=>{
        var inputs=d.querySelectorAll('input');
        servicesCostUSD+=(parseFloat(inputs[1]?.value)||0);
      });
      document.getElementById('services-subtotal').textContent=fmtUSD(servicesCostUSD);

      // Maintenance annual
      var maintAnnualUSD=maintUSD*12;
      var totalCostUSD=laborCostUSD+servicesCostUSD+maintAnnualUSD;
      var margin=getMargin()/100;
      var clientPriceUSD=totalCostUSD*(1+margin);
      // Round to nearest 50 in ARS equivalent, or 50 USD
      var clientPriceRounded=Math.ceil(clientPriceUSD/50)*50;
      var marginAmtUSD=clientPriceRounded-totalCostUSD;
      var marginPct=totalCostUSD>0?Math.round(marginAmtUSD/clientPriceRounded*100):0;

      // Update UI
      document.getElementById('r-labor').textContent=fmt(laborCostUSD);
      document.getElementById('r-labor-alt').textContent=fmtAlt(laborCostUSD);
      document.getElementById('r-services').textContent=fmt(servicesCostUSD);
      document.getElementById('r-services-alt').textContent=fmtAlt(servicesCostUSD);
      if(maintUSD>0){
        document.getElementById('r-maint').textContent=fmt(maintAnnualUSD);
        document.getElementById('r-maint-alt').textContent=fmtAlt(maintAnnualUSD)+'/año';
      } else {
        document.getElementById('r-maint').textContent='—';
        document.getElementById('r-maint-alt').textContent='';
      }
      document.getElementById('r-total-cost').textContent=fmt(totalCostUSD);
      document.getElementById('r-margin').textContent='+'+fmt(marginAmtUSD);
      document.getElementById('r-margin-pct').textContent=marginPct;
      document.getElementById('r-client-price').textContent=fmt(clientPriceRounded);
      document.getElementById('r-client-price-alt').textContent=fmtAlt(clientPriceRounded);
      document.getElementById('r-monthly').textContent=maintUSD>0?fmt(maintUSD):'—';

      // Update client view if visible
      if(!document.getElementById('client-view').classList.contains('hidden')){
        updateClientView(clientPriceRounded,laborCostUSD,servicesCostUSD,maintAnnualUSD);
      }
    }

    // Benefits/opportunities
    function getBenefits(){
      var type=document.getElementById('proj-type').value;
      return (BENEFITS_BY_TYPE[type]||BENEFITS_BY_TYPE.custom).concat(customBenefits);
    }
    function getOpportunities(){
      var type=document.getElementById('proj-type').value;
      return (OPPORTUNITIES_BY_TYPE[type]||OPPORTUNITIES_BY_TYPE.custom).concat(customOpportunities);
    }
    function addBenefit(){
      var text=document.getElementById('new-benefit').value.trim();
      if(!text)return;
      var type=document.getElementById('new-benefit-type').value;
      if(type==='benefit')customBenefits.push(text);
      else customOpportunities.push(text);
      document.getElementById('new-benefit').value='';
      if(!document.getElementById('client-view').classList.contains('hidden')){
        var totals=getCurrentTotals();
        updateClientView(totals.clientPrice,totals.labor,totals.services,totals.maint);
      }
    }
    function getCurrentTotals(){
      var hourly=getHourly();
      var laborCostUSD=laborRows.reduce((s,r)=>s+(r.hours*(r.rate||hourly)),0);
      var servicesCostUSD=Object.values(servicesState).reduce((s,v)=>v.checked?s+v.usd*(v.type==='monthly'?v.months:1):s,0);
      document.querySelectorAll('#custom-services > div').forEach(d=>{var i=d.querySelectorAll('input');servicesCostUSD+=(parseFloat(i[1]?.value)||0);});
      var maintAnnualUSD=maintUSD*12;
      var totalCost=laborCostUSD+servicesCostUSD+maintAnnualUSD;
      var clientPrice=Math.ceil(totalCost*(1+getMargin()/100)/50)*50;
      return {clientPrice,labor:laborCostUSD,services:servicesCostUSD,maint:maintAnnualUSD,totalCost};
    }

    function updateClientView(clientPrice,labor,services,maint){
      var name=document.getElementById('proj-name').value||'Proyecto';
      var client=document.getElementById('proj-client').value;
      var desc=document.getElementById('proj-desc').value||'—';
      document.getElementById('cv-title').textContent=name;
      document.getElementById('cv-client').textContent=client?'Para: '+client:'';
      document.getElementById('cv-desc').textContent=desc;
      document.getElementById('cv-date').textContent='Fecha: '+new Date().toLocaleDateString('es-AR');
      document.getElementById('cv-total').textContent=fmt(clientPrice);

      // Breakdown — distribute margin proportionally across items
      var totalCost=labor+services+maint;
      var marginFactor=totalCost>0?clientPrice/totalCost:1;
      var laborClient=labor*marginFactor;
      var servicesClient=services*marginFactor;
      var maintClient=maint*marginFactor;
      var breakdown='';
      if(labor>0)breakdown+=\`<div class="flex justify-between text-sm"><span class="text-slate-600">Diseño y desarrollo</span><span class="font-medium text-slate-800">\${fmt(laborClient)}</span></div>\`;
      if(services>0)breakdown+=\`<div class="flex justify-between text-sm mt-1"><span class="text-slate-600">Servicios y hosting</span><span class="font-medium text-slate-800">\${fmt(servicesClient)}</span></div>\`;
      if(maint>0)breakdown+=\`<div class="flex justify-between text-sm mt-1"><span class="text-slate-600">Mantenimiento (anual)</span><span class="font-medium text-slate-800">\${fmt(maintClient)}</span></div>\`;
      document.getElementById('cv-breakdown').innerHTML=breakdown;

      // Monthly row
      if(maintUSD>0){
        document.getElementById('cv-monthly-row').classList.remove('hidden');
        document.getElementById('cv-monthly').textContent=fmt(maintUSD)+'/mes';
      } else {
        document.getElementById('cv-monthly-row').classList.add('hidden');
      }

      // Benefits
      document.getElementById('cv-benefits').innerHTML=getBenefits().map(b=>
        \`<li class="flex items-start gap-2 text-sm text-slate-600"><span class="text-emerald-500 flex-shrink-0 mt-0.5">✅</span><span>\${b}</span></li>\`
      ).join('');
      document.getElementById('cv-opportunities').innerHTML=getOpportunities().map(o=>
        \`<li class="flex items-start gap-2 text-sm text-slate-600"><span class="text-blue-500 flex-shrink-0 mt-0.5">📈</span><span>\${o}</span></li>\`
      ).join('');
    }

    function toggleClientView(){
      var cv=document.getElementById('client-view');
      cv.classList.toggle('hidden');
      if(!cv.classList.contains('hidden')){
        var t=getCurrentTotals();
        updateClientView(t.clientPrice,t.labor,t.services,t.maint);
        cv.scrollIntoView({behavior:'smooth',block:'start'});
      }
    }

    function onTypeChange(){
      var type=document.getElementById('proj-type').value;
      applyServicesByType(type);
      updateMaintRec(type);
      if(!document.getElementById('client-view').classList.contains('hidden')){
        var t=getCurrentTotals();
        updateClientView(t.clientPrice,t.labor,t.services,t.maint);
      }
    }

    // Load from project
    function loadProject(){
      var id=document.getElementById('proj-load').value;
      if(!id)return;
      var p=PROJECTS_DATA.find(x=>x.id===id);
      if(!p)return;
      document.getElementById('proj-name').value=p.title||'';
      document.getElementById('proj-client').value=p.client||'';
      document.getElementById('proj-desc').value=p.description||'';
      // Auto-link quote to this project
      document.getElementById('quote-project-link').value=id;
      var catMap={wordpress:'web',landing:'web',ecommerce:'ecommerce',app:'app',bot:'bot',design:'design',maintenance:'maintenance'};
      var type=catMap[p.category]||'web';
      document.getElementById('proj-type').value=type;
      applyServicesByType(type);
      updateMaintRec(type);
      calcUpdate();
    }

    function escVal(s){ return (s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

    function getQuoteData(){
      var t=getCurrentTotals();
      return {
        id: Date.now(),
        date: new Date().toISOString(),
        rate: document.getElementById('cfg-rate').value,
        hourlyArs: document.getElementById('cfg-hourly-ars').value,
        hourlyUsd: document.getElementById('cfg-hourly-usd').value,
        clientType,
        margin: document.getElementById('cfg-margin').value,
        name: document.getElementById('proj-name').value,
        client: document.getElementById('proj-client').value,
        type: document.getElementById('proj-type').value,
        desc: document.getElementById('proj-desc').value,
        projectId: document.getElementById('quote-project-link').value,
        laborRows,
        services: servicesState,
        maintUSD,
        customBenefits,
        customOpportunities,
        currency: primaryCurrency,
        priceUSD: t.clientPrice,
        priceARS: t.clientPrice * parseFloat(document.getElementById('cfg-rate').value||1000),
      };
    }

    function saveQuote(){
      var data=getQuoteData();
      localStorage.setItem('dt-quote-last',JSON.stringify(data));
      // Push to history (max 20)
      var hist=JSON.parse(localStorage.getItem('dt-quote-history')||'[]');
      hist.unshift({id:data.id,date:data.date,name:data.name,client:data.client,type:data.type,priceARS:data.priceARS,priceUSD:data.priceUSD,projectId:data.projectId,data});
      if(hist.length>20)hist=hist.slice(0,20);
      localStorage.setItem('dt-quote-history',JSON.stringify(hist));
      if(typeof showToast==='function')showToast('Cotización guardada');
      renderHistory();
    }

    function loadSavedQuote(){
      loadCfg();
      var saved=localStorage.getItem('dt-quote-last');
      if(!saved)return;
      try{
        var d=JSON.parse(saved);
        document.getElementById('cfg-rate').value=d.rate||1000;
        document.getElementById('cfg-hourly-ars').value=d.hourlyArs||25000;
        document.getElementById('cfg-hourly-usd').value=d.hourlyUsd||25;
        document.getElementById('cfg-margin').value=d.margin||40;
        document.getElementById('proj-name').value=d.name||'';
        document.getElementById('proj-client').value=d.client||'';
        document.getElementById('proj-type').value=d.type||'web';
        document.getElementById('proj-desc').value=d.desc||'';
        if(d.projectId)document.getElementById('quote-project-link').value=d.projectId;
        if(d.clientType)clientType=d.clientType;
        if(d.laborRows&&d.laborRows.length){laborRows=d.laborRows;laborRowId=Math.max(...d.laborRows.map(r=>r.id));}
        if(d.services)Object.assign(servicesState,d.services);
        if(d.maintUSD!=null)maintUSD=d.maintUSD;
        if(d.customBenefits)customBenefits=d.customBenefits;
        if(d.customOpportunities)customOpportunities=d.customOpportunities;
        if(d.currency)primaryCurrency=d.currency;
      }catch(e){}
    }

    // History
    function toggleHistory(){
      var p=document.getElementById('history-panel');
      p.classList.toggle('hidden');
      if(!p.classList.contains('hidden'))renderHistory();
    }
    function renderHistory(){
      var hist=JSON.parse(localStorage.getItem('dt-quote-history')||'[]');
      var el=document.getElementById('history-list');
      if(!hist.length){el.innerHTML='<div class="px-5 py-4 text-xs text-slate-400 text-center">Sin historial guardado</div>';return;}
      el.innerHTML=hist.map((h,i)=>{
        var d=new Date(h.date).toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'2-digit'});
        var price=h.priceARS>0?'$'+(h.priceARS).toLocaleString('es-AR',{maximumFractionDigits:0})+' ARS':'—';
        return \`<div class="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer" onclick="loadHistoryQuote(\${i})">
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold text-slate-700 truncate">\${h.name||'Sin nombre'}</div>
            <div class="text-[10px] text-slate-400">\${h.client||''} · \${d}</div>
          </div>
          <div class="text-sm font-bold text-blue-600 flex-shrink-0">\${price}</div>
          <button onclick="event.stopPropagation();deleteHistory(\${i})" class="text-slate-300 hover:text-red-400 text-xs flex-shrink-0">✕</button>
        </div>\`;
      }).join('');
    }
    function loadHistoryQuote(i){
      var hist=JSON.parse(localStorage.getItem('dt-quote-history')||'[]');
      if(!hist[i])return;
      var d=hist[i].data;
      localStorage.setItem('dt-quote-last',JSON.stringify(d));
      location.reload();
    }
    function deleteHistory(i){
      var hist=JSON.parse(localStorage.getItem('dt-quote-history')||'[]');
      hist.splice(i,1);
      localStorage.setItem('dt-quote-history',JSON.stringify(hist));
      renderHistory();
    }
    function clearHistory(){
      if(!confirm('¿Limpiar todo el historial?'))return;
      localStorage.removeItem('dt-quote-history');
      renderHistory();
    }

    // Save to project documents
    async function saveToProject(){
      var projectId=document.getElementById('quote-project-link').value;
      if(!projectId){ if(typeof showToast==='function')showToast('Seleccioná un proyecto primero','error');return; }
      var data=getQuoteData();
      var t=getCurrentTotals();
      var btn=event.currentTarget;
      btn.textContent='Guardando...';
      btn.disabled=true;
      try{
        var r=await fetch('/admin/api/save-quote',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({projectId,quoteData:data,priceARS:data.priceARS,priceUSD:t.clientPrice})
        });
        var j=await r.json();
        if(j.ok){
          document.getElementById('save-status').className='text-xs text-center py-1 rounded-lg bg-emerald-50 text-emerald-700 mt-1';
          document.getElementById('save-status').textContent='✅ Guardado en el proyecto · '+new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
          document.getElementById('save-status').classList.remove('hidden');
          if(typeof showToast==='function')showToast('Presupuesto guardado en el proyecto');
          saveQuote();
        }else{
          if(typeof showToast==='function')showToast(j.error||'Error al guardar','error');
        }
      }catch(e){
        if(typeof showToast==='function')showToast('Error de red','error');
      }
      btn.textContent='💾 Guardar en documentos del proyecto';
      btn.disabled=false;
    }

    function printQuote(){
      if(document.getElementById('client-view').classList.contains('hidden')){
        toggleClientView();
        setTimeout(()=>window.print(),400);
      } else {
        window.print();
      }
    }

    // Init
    initLaborRows();
    initServices();
    loadSavedQuote();
    renderLaborRows();
    renderServices();
    setClientType(clientType);
    updateMaintRec(document.getElementById('proj-type').value);
    calcUpdate();
    </script>`;

  res.send(layout('Presupuestos', body, { activePage: 'presupuesto', user: req.session?.user }));
});

// ─── Changelog ──────────────────────────────────────────────────────────────

router.get('/changelog', requireAuth, (req, res) => {
  const pendingCount = 0;

  const changelogHtml = CHANGELOG.map((release, idx) => {
    const isLatest = idx === 0;
    const dateFormatted = new Date(release.date + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `
    <div class="relative pl-8 pb-8 ${idx < CHANGELOG.length - 1 ? 'border-l-2 border-slate-200' : ''} ml-3">
      <div class="absolute -left-[9px] top-1 w-[18px] h-[18px] rounded-full ${isLatest ? 'bg-blue-500 ring-4 ring-blue-100' : 'bg-slate-300'} flex items-center justify-center">
        ${isLatest ? '<div class="w-2 h-2 bg-white rounded-full"></div>' : ''}
      </div>
      <div class="bg-white rounded-xl border ${isLatest ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200'} overflow-hidden">
        <div class="px-5 py-4 ${isLatest ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : ''}">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="px-2.5 py-1 rounded-lg text-xs font-bold ${isLatest ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}">v${release.version}</span>
            <span class="text-xs text-slate-400">${dateFormatted}</span>
            ${isLatest ? '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase">Actual</span>' : ''}
          </div>
          <h3 class="text-sm font-semibold text-slate-800 mt-2">${escapeHtml(release.title)}</h3>
        </div>
        <div class="px-5 py-3 border-t border-slate-100">
          <ul class="space-y-1.5">
            ${release.changes.map(c => `
              <li class="flex items-start gap-2 text-sm text-slate-600">
                <span class="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                <span>${escapeHtml(c)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    </div>`;
  }).join('');

  const body = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-slate-900">Historial de actualizaciones</h1>
        <p class="text-sm text-slate-400 mt-1">Todas las mejoras y correcciones de DT Systems</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg">v${APP_VERSION}</span>
      </div>
    </div>
    <div class="max-w-2xl">
      ${changelogHtml}
    </div>`;

  res.send(layout('Actualizaciones', body, { pendingCount, activePage: 'changelog', user: req.session?.user }));
});

// ─── Search API (Command Palette) ────────────────────────────────────────────

router.get('/api/search-index', requireAuth, async (req, res) => {
  try {
    const [clients, projects, clientRecords] = await Promise.all([
      db.listAllClients(),
      db.listProjects(),
      db.listClientRecords ? db.listClientRecords() : Promise.resolve([]),
    ]);
    const items = [];

    // Static pages
    items.push({ type: 'page', icon: '📊', title: 'Dashboard', sub: '', href: '/admin' });
    items.push({ type: 'page', icon: '💬', title: 'Pipeline', sub: 'Clientes WhatsApp', href: '/admin/clients' });
    items.push({ type: 'page', icon: '🎛️', title: 'Centro de Control', sub: 'Acciones pendientes', href: '/admin/control' });
    items.push({ type: 'page', icon: '📁', title: 'Proyectos', sub: 'Todos los proyectos', href: '/admin/projects' });
    items.push({ type: 'page', icon: '✅', title: 'Tareas', sub: 'Kanban de tareas', href: '/admin/tasks' });
    items.push({ type: 'page', icon: '👥', title: 'Clientes', sub: 'Base de clientes', href: '/admin/clientes' });
    items.push({ type: 'page', icon: '📂', title: 'Documentos', sub: 'Archivos y docs', href: '/admin/documentos' });
    items.push({ type: 'page', icon: '💰', title: 'Finanzas', sub: 'Costos y estimaciones', href: '/admin/finanzas' });
    items.push({ type: 'page', icon: '🧮', title: 'Presupuestos', sub: 'Calculadora ARS/USD', href: '/admin/presupuesto' });

    // WA Clients
    clients.forEach(c => {
      const name = c.report?.cliente?.nombre || c.context?.nombre || c.phone;
      items.push({ type: 'client', icon: '💬', title: name, sub: c.phone + ' · ' + (STAGES.find(s => s.key === c.client_stage)?.label || c.client_stage), href: '/admin/client/' + encodeURIComponent(c.phone) });
    });

    // Client records
    (clientRecords || []).forEach(cr => {
      items.push({ type: 'client', icon: '👤', title: cr.name || cr.company || '-', sub: (cr.phone || '') + ' · ' + (cr.company || ''), href: '/admin/clientes/' + cr.id });
    });

    // Projects
    projects.forEach(p => {
      items.push({ type: 'project', icon: '📁', title: p.title || p.client_name, sub: p.client_name + ' · ' + (PROJECT_STATUS.find(s => s.key === p.status)?.label || p.status), href: '/admin/projects/' + p.id });
    });

    // Tasks
    projects.forEach(p => {
      (p.tasks || []).forEach((t, i) => {
        if (!t.done) {
          items.push({ type: 'task', icon: t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '⚪', title: t.text, sub: (p.title || p.client_name), href: '/admin/projects/' + p.id });
        }
      });
    });

    res.json(items);
  } catch (err) {
    console.error('[api/search-index] Error:', err.message);
    res.json([]);
  }
});

// ─── Kanban API endpoints (JSON) ──────────────────────────────────────────────

router.post('/api/task-move', requireAuth, async (req, res) => {
  try {
    const { projectId, taskIdx, newStatus } = req.body;
    const project = await db.getProject(projectId);
    if (!project) return res.json({ ok: false, error: 'Proyecto no encontrado' });
    const tasks = project.tasks || [];
    const idx = parseInt(taskIdx, 10);
    if (!tasks[idx]) return res.json({ ok: false, error: 'Tarea no encontrada' });

    if (newStatus === 'done') {
      tasks[idx].done = true;
      tasks[idx].status = 'done';
    } else if (newStatus === 'in_progress') {
      tasks[idx].done = false;
      tasks[idx].status = 'in_progress';
    } else {
      tasks[idx].done = false;
      tasks[idx].status = 'todo';
    }
    await db.updateProject(projectId, { ...project, tasks });
    res.json({ ok: true });
  } catch (err) {
    console.error('[api/task-move] Error:', err.message);
    res.json({ ok: false, error: err.message });
  }
});

router.post('/api/project-status', requireAuth, async (req, res) => {
  try {
    const { projectId, newStatus } = req.body;
    const valid = PROJECT_STATUS.map(s => s.key);
    if (!valid.includes(newStatus)) return res.json({ ok: false, error: 'Status inválido' });
    const project = await db.getProject(projectId);
    if (!project) return res.json({ ok: false, error: 'Proyecto no encontrado' });
    await db.updateProject(projectId, { ...project, status: newStatus });
    res.json({ ok: true });
  } catch (err) {
    console.error('[api/project-status] Error:', err.message);
    res.json({ ok: false, error: err.message });
  }
});

router.post('/api/client-stage', requireAuth, async (req, res) => {
  try {
    const { phone, newStage } = req.body;
    const valid = STAGES.map(s => s.key);
    if (!valid.includes(newStage)) return res.json({ ok: false, error: 'Stage inválido' });
    await db.updateClientStage(phone, newStage);
    await db.appendTimelineEvent(phone, { event: 'stage_changed', note: `Movido a ${STAGES.find(s => s.key === newStage)?.label || newStage} (kanban)` });
    res.json({ ok: true });
  } catch (err) {
    console.error('[api/client-stage] Error:', err.message);
    res.json({ ok: false, error: err.message });
  }
});

router.post('/api/save-quote', requireAuth, async (req, res) => {
  try {
    const { projectId, quoteData, priceARS, priceUSD } = req.body;
    const project = await db.getProject(projectId);
    if (!project) return res.json({ ok: false, error: 'Proyecto no encontrado' });
    const docs = Array.isArray(project.documents) ? [...project.documents] : [];
    const quoteDoc = {
      id: Date.now(),
      type: 'presupuesto',
      name: `Presupuesto — ${quoteData?.name || 'Sin nombre'} (${new Date().toLocaleDateString('es-AR')})`,
      date: new Date().toISOString(),
      priceARS: priceARS || 0,
      priceUSD: priceUSD || 0,
      data: quoteData || {},
    };
    docs.push(quoteDoc);
    await db.updateProject(projectId, { ...project, documents: docs });
    res.json({ ok: true, docId: quoteDoc.id });
  } catch (err) {
    console.error('[api/save-quote] Error:', err.message);
    res.json({ ok: false, error: err.message });
  }
});

// ─── Global error handler para rutas del admin ───────────────────────────────
// Captura cualquier error lanzado desde route handlers (sync o async con express-async-errors)
router.use((err, req, res, next) => {
  console.error('[admin] Error en ruta', req.method, req.path, ':', err?.message || err);
  console.error(err?.stack);
  if (res.headersSent) return next(err);
  try {
    res.status(500).send(layout('Error interno', `
      <div class="flex flex-col items-center justify-center py-20 text-center">
        <div class="text-5xl mb-4">⚠️</div>
        <h1 class="text-xl font-bold text-slate-800 mb-2">Algo salió mal</h1>
        <p class="text-slate-500 mb-6 max-w-md">${escapeHtml(err?.message || 'Error desconocido')}</p>
        <a href="/admin" class="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">← Volver al inicio</a>
      </div>
    `, { user: req.session?.user }));
  } catch (e) {
    res.status(500).send('<h1>Error interno</h1><a href="/admin">Volver</a>');
  }
});

module.exports = router;
