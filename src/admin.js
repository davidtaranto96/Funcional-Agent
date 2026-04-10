const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const db = require('./db');
const orchestrator = require('./orchestrator');

// ─── Multer: upload de archivos para proyectos ───────────────────────────────

const PROJECT_FILES_DIR = path.join(__dirname, '..', 'data', 'project-files');
fs.mkdirSync(PROJECT_FILES_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(PROJECT_FILES_DIR, req.params.id);
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

const router = express.Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
  return [
    { label: 'Conversación iniciada',    done: true },
    { label: 'Datos recopilados',        done: conv.stage === 'done' || !!conv.report },
    { label: 'Reporte generado',         done: !!conv.report },
    { label: 'Demo generado',            done: !!conv.demo_status && !['none','generating'].includes(conv.demo_status) },
    { label: 'Revisado por David',       done: ['approved','sent','rejected'].includes(conv.demo_status) },
    { label: 'Demo enviado al cliente',  done: conv.demo_status === 'sent' || hasEvent('demo_sent_to_client') },
    { label: 'Negociando',              done: ['negotiating','won'].includes(conv.client_stage) },
    { label: 'Proyecto ganado',          done: conv.client_stage === 'won' },
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

function layout(title, body, { pendingCount = 0, activePage = '' } = {}) {
  const navItem = (href, icon, label, page) => {
    const active = activePage === page;
    return `<a href="${href}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}">
      <span>${icon}</span><span>${label}</span>
      ${page === 'clients' && pendingCount > 0 ? `<span class="ml-auto bg-orange-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">${pendingCount}</span>` : ''}
    </a>`;
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · WPanalista</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ::-webkit-scrollbar{width:4px;height:4px}
    ::-webkit-scrollbar-track{background:#f1f5f9}
    ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:2px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .spin{animation:spin 1s linear infinite}
  </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen" style="display:flex">
  <aside style="width:220px;min-height:100vh;position:fixed;top:0;left:0;z-index:20" class="bg-slate-900 flex flex-col">
    <div class="p-5 border-b border-slate-700/50">
      <div class="text-base font-bold text-white tracking-tight">WPanalista</div>
      <div class="text-xs text-slate-500 mt-0.5">Panel de trabajo</div>
    </div>
    <nav class="flex-1 p-3 space-y-0.5 mt-1">
      ${navItem('/admin', '📊', 'Dashboard', 'dashboard')}
      ${navItem('/admin/clients', '💬', 'Leads WA', 'clients')}
      ${navItem('/admin/projects', '📁', 'Proyectos', 'projects')}
    </nav>
    <form method="POST" action="/admin/logout" class="p-4 border-t border-slate-700/50">
      <button class="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors w-full">
        🚪 Cerrar sesión
      </button>
    </form>
  </aside>
  <div style="margin-left:220px;flex:1;min-height:100vh">
    <main class="max-w-5xl mx-auto p-6 pb-16">${body}</main>
  </div>
</body>
</html>`;
}

// ─── Login ───────────────────────────────────────────────────────────────────

const passport = require('passport');

function loginPage(errorMsg = '') {
  const googleConfigured = !!process.env.GOOGLE_CLIENT_ID;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Login · WPanalista</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gradient-to-br from-slate-900 to-slate-800 min-h-screen flex items-center justify-center">
  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <div class="text-3xl font-bold text-white tracking-tight">WPanalista</div>
      <div class="text-slate-400 text-sm mt-1">Panel de trabajo</div>
    </div>
    <div class="bg-white rounded-2xl shadow-2xl p-8">
      ${errorMsg ? `<div class="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">${errorMsg}</div>` : ''}
      ${googleConfigured ? `
      <a href="/admin/auth/google"
        class="flex items-center justify-center gap-3 w-full border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700 font-semibold py-3 rounded-xl transition-colors mb-4">
        <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>
        Continuar con Google
      </a>
      <div class="relative my-4"><div class="absolute inset-0 flex items-center"><div class="w-full border-t border-slate-100"></div></div><div class="relative flex justify-center"><span class="bg-white px-3 text-xs text-slate-400">o usá contraseña</span></div></div>` : ''}
      <form method="POST" action="/admin/login">
        <input type="password" name="password" autofocus placeholder="Contraseña"
          class="w-full border border-slate-200 rounded-xl px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
        <button class="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-semibold text-sm transition-colors">Entrar</button>
      </form>
    </div>
  </div>
</body></html>`;
}

router.get('/login', (req, res) => {
  const errors = { 1: 'Contraseña incorrecta', 2: 'Email no autorizado para acceder al panel' };
  res.send(loginPage(errors[req.query.error] || ''));
});

router.post('/login', (req, res) => {
  if (req.body.password && req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.authed = true;
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
  req.session.destroy(() => res.redirect('/admin/login'));
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
    { label: 'Leads WA',        value: clients.length,        icon: '💬', grad: 'from-blue-500 to-blue-600',      sub: `${clients.filter(c => c.client_stage !== 'lost' && c.client_stage !== 'dormant').length} activos`, href: '/admin/clients' },
    { label: 'Demos pendientes', value: pendingReview.length,  icon: '⏳', grad: pendingReview.length > 0 ? 'from-orange-400 to-orange-500' : 'from-slate-400 to-slate-500', sub: 'para revisar', alert: pendingReview.length > 0, href: '/admin/clients' },
    { label: 'Proyectos activos',value: activeProjects,        icon: '📁', grad: 'from-purple-500 to-purple-600',  sub: `${projects.length} en total`, href: '/admin/projects' },
    { label: 'Tareas pendientes',value: pendingTasks,          icon: '✅', grad: pendingTasks > 0 ? 'from-amber-400 to-amber-500' : 'from-emerald-500 to-emerald-600', sub: 'en proyectos', href: '/admin/projects' },
  ].map(m => `
    <a href="${m.href || '#'}" class="bg-gradient-to-br ${m.grad} rounded-2xl p-5 text-white relative overflow-hidden block hover:opacity-95 hover:scale-[1.01] transition-all cursor-pointer no-underline">
      <div class="flex items-start justify-between">
        <div>
          <div class="text-xs font-medium opacity-75 uppercase tracking-wide">${m.label}</div>
          <div class="text-4xl font-bold mt-1">${m.value}</div>
          <div class="text-xs opacity-60 mt-1">${m.sub}</div>
        </div>
        <div class="text-3xl opacity-50">${m.icon}</div>
      </div>
      ${m.alert ? '<div class="absolute top-3 right-3 w-2 h-2 bg-white rounded-full animate-pulse opacity-80"></div>' : ''}
    </a>`).join('');

  // Alert strip
  const alertStrip = pendingReview.length ? `
    <div class="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-center gap-3">
      <span class="text-2xl">⚠️</span>
      <div class="flex-1">
        <div class="font-semibold text-orange-800 text-sm">Demos esperando tu revisión</div>
        <div class="text-xs text-orange-600 mt-0.5">
          ${pendingReview.map(c => `<a href="/admin/review/${encodeURIComponent(c.phone)}" class="underline font-medium">${escapeHtml(c.report?.cliente?.nombre || c.phone)}</a>`).join(' · ')}
        </div>
      </div>
      <a href="/admin/review/${encodeURIComponent(pendingReview[0].phone)}" class="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
        Revisar →
      </a>
    </div>` : '';

  // Pipeline funnel
  const pipelineHtml = STAGES.slice(0, 6).map(s => {
    const count = clients.filter(c => c.client_stage === s.key).length;
    const pct = clients.length > 0 ? Math.round(count / clients.length * 100) : 0;
    return `<div class="flex items-center gap-3">
      <div class="text-xs text-slate-500 w-28 truncate">${s.label}</div>
      <div class="flex-1 bg-slate-100 rounded-full h-2">
        <div class="h-2 rounded-full" style="width:${pct}%;background:${s.dot}"></div>
      </div>
      <div class="text-xs font-semibold text-slate-700 w-5 text-right">${count}</div>
    </div>`;
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

  const body = `
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Dashboard</h1>
        <div class="text-sm text-slate-400 mt-0.5">${new Date().toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
      </div>
    </div>
    ${alertStrip}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">${metricCards}</div>
    <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
      <div class="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 class="text-sm font-semibold text-slate-700 mb-4">Pipeline WA</h2>
        <div class="space-y-3">${pipelineHtml || '<p class="text-sm text-slate-400">Sin leads</p>'}</div>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-700">Últimos leads</h2>
          <a href="/admin/clients" class="text-xs text-blue-600 hover:underline">Ver todos →</a>
        </div>
        ${recentLeads || '<p class="text-sm text-slate-400">Sin leads</p>'}
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-700">Últimos proyectos</h2>
          <a href="/admin/projects" class="text-xs text-blue-600 hover:underline">Ver todos →</a>
        </div>
        ${recentProjects || '<p class="text-sm text-slate-400">Sin proyectos</p>'}
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 class="text-sm font-semibold text-slate-700 mb-3">Actividad reciente</h2>
        <div>${activityFeed || '<p class="text-sm text-slate-400">Sin actividad todavía</p>'}</div>
      </div>
    </div>`;

  res.send(layout('Dashboard', body, { pendingCount: pendingReview.length, activePage: 'dashboard' }));
});

// ─── WA Clients list ─────────────────────────────────────────────────────────

router.get('/clients', requireAuth, async (req, res) => {
  const filter = req.query.stage || 'all';
  const search = (req.query.q || '').toLowerCase();
  let clients = await db.listAllClients();
  const allClients = clients;
  const pendingReview = allClients.filter(c => c.demo_status === 'pending_review');

  if (search) clients = clients.filter(c => {
    const n = (c.report?.cliente?.nombre || c.context?.nombre || '').toLowerCase();
    return n.includes(search) || c.phone.includes(search) || (c.report?.proyecto?.tipo || '').toLowerCase().includes(search);
  });
  if (filter !== 'all') clients = clients.filter(c => c.client_stage === filter);

  const tabs = [{ key: 'all', label: 'Todos', count: allClients.length },
    ...STAGES.map(s => ({ key: s.key, label: s.label, count: allClients.filter(c => c.client_stage === s.key).length }))
  ].filter(t => t.key === 'all' || t.count > 0);

  const tabHtml = tabs.map(t => `
    <a href="/admin/clients?stage=${t.key}${search ? '&q=' + encodeURIComponent(search) : ''}"
      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === t.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}">
      ${t.label} <span class="text-xs ${filter === t.key ? 'opacity-70' : 'text-slate-400'}">${t.count}</span>
    </a>`).join('');

  const rows = clients.map(c => {
    const nombre = c.report?.cliente?.nombre || c.context?.nombre || '—';
    const tipo = c.report?.proyecto?.tipo || '—';
    const phoneUrl = encodeURIComponent(c.phone);
    const steps = processSteps(c);
    const done = steps.filter(s => s.done).length;
    const pct = Math.round(done / steps.length * 100);
    return `
      <tr class="border-b border-slate-100 hover:bg-blue-50/30 transition-colors cursor-pointer group" onclick="location.href='/admin/client/${phoneUrl}'">
        <td class="px-4 py-3.5">
          <div class="font-medium text-slate-800">${escapeHtml(nombre)}</div>
          <div class="text-xs text-slate-400 mt-0.5">${escapeHtml(c.phone)}</div>
        </td>
        <td class="px-4 py-3.5 text-sm text-slate-600 max-w-xs"><div class="truncate">${escapeHtml(tipo)}</div></td>
        <td class="px-4 py-3.5">${stageBadge(c.client_stage)}</td>
        <td class="px-4 py-3.5">${demoStatusBadge(c.demo_status)}</td>
        <td class="px-4 py-3.5">
          <div class="flex items-center gap-2">
            <div class="bg-slate-100 rounded-full h-1.5" style="width:72px">
              <div class="h-1.5 rounded-full bg-blue-500" style="width:${pct}%"></div>
            </div>
            <span class="text-xs text-slate-400">${done}/${steps.length}</span>
          </div>
        </td>
        <td class="px-4 py-3.5 text-xs text-slate-400">${timeAgo(c.updated_at)}</td>
        <td class="px-4 py-3.5 text-right">
          ${c.demo_status === 'pending_review'
            ? `<a href="/admin/review/${phoneUrl}" class="bg-orange-100 text-orange-700 hover:bg-orange-200 text-xs font-semibold px-2.5 py-1 rounded-lg" onclick="event.stopPropagation()">Revisar</a>`
            : `<a href="/admin/client/${phoneUrl}" class="opacity-0 group-hover:opacity-100 text-blue-600 text-xs transition-opacity" onclick="event.stopPropagation()">Abrir →</a>`}
        </td>
      </tr>`;
  }).join('');

  const body = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Leads WhatsApp</h1>
      <div class="flex items-center gap-2">
        <span class="text-sm text-slate-400">${clients.length} resultado${clients.length !== 1 ? 's' : ''}</span>
        <div class="relative group">
          <button class="text-xs border border-dashed border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500 px-3 py-1.5 rounded-lg transition-colors">
            + Lead de prueba
          </button>
          <div class="hidden group-hover:block absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 w-48 py-1">
            <form method="POST" action="/admin/create-demo-lead"><input type="hidden" name="tipo" value="web">
              <button class="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-slate-600">🌐 Web (Panadería)</button></form>
            <form method="POST" action="/admin/create-demo-lead"><input type="hidden" name="tipo" value="bot">
              <button class="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-slate-600">💬 Bot WA (Veterinaria)</button></form>
            <form method="POST" action="/admin/create-demo-lead"><input type="hidden" name="tipo" value="app">
              <button class="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-slate-600">📱 App móvil (Gimnasio)</button></form>
          </div>
        </div>
      </div>
    </div>
    <div class="flex items-center gap-3 mb-4">
      <form method="GET" action="/admin/clients" class="flex-1">
        <input type="hidden" name="stage" value="${escapeHtml(filter)}">
        <input type="text" name="q" value="${escapeHtml(search)}" placeholder="Buscar por nombre, teléfono o proyecto..."
          class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      </form>
    </div>
    <div class="flex items-center gap-1.5 mb-5 flex-wrap">${tabHtml}</div>
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <table class="w-full">
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
    </div>`;

  res.send(layout('Leads WA', body, { pendingCount: pendingReview.length, activePage: 'clients' }));
});

// ─── WA Client detail ────────────────────────────────────────────────────────

router.get('/client/:phone', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  const conv = await db.getConversation(phone);
  if (!conv) return res.status(404).send(layout('No encontrado', '<p class="text-slate-500 p-4">Cliente no encontrado.</p>'));

  const nombre = conv.report?.cliente?.nombre || conv.context?.nombre || '—';
  const email = conv.report?.cliente?.email || '';
  const proyecto = conv.report?.proyecto || {};
  const requisitos = conv.report?.requisitos || {};
  const resumen = conv.report?.resumen_ejecutivo || '';
  const slug = phoneSlug(phone);
  const phoneUrl = encodeURIComponent(phone);
  const allClients = await db.listAllClients();
  const pendingCount = allClients.filter(c => c.demo_status === 'pending_review').length;

  const steps = processSteps(conv);
  const doneCount = steps.filter(s => s.done).length;

  const stepperHtml = steps.map((s, i) => {
    const isLast = i === steps.length - 1;
    return `<div class="flex items-center ${isLast ? '' : 'flex-1'}">
      <div class="flex flex-col items-center">
        <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}">
          ${s.done ? '<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
        </div>
        <div class="text-[10px] text-slate-400 mt-1 text-center leading-tight w-14">${s.label}</div>
      </div>
      ${!isLast ? `<div class="h-0.5 flex-1 mb-4 mx-1 ${s.done ? 'bg-blue-500' : 'bg-slate-200'}"></div>` : ''}
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

  const infoRows = [
    ['Tipo', proyecto.tipo], ['Plataforma', proyecto.plataforma],
    ['Estado actual', proyecto.estado_actual], ['Stack', requisitos.stack_sugerido],
    ['Presupuesto', requisitos.presupuesto], ['Plazo', requisitos.plazo], ['Urgencia', requisitos.urgencia],
  ].filter(([, v]) => v);

  const body = `
    <div class="mb-5"><a href="/admin/clients" class="text-sm text-slate-500 hover:text-blue-600">← Leads WA</a></div>
    <div class="flex items-start justify-between mb-5">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">${escapeHtml(nombre)}</h1>
        <div class="flex items-center gap-2 mt-1 text-xs text-slate-400">
          <span>${escapeHtml(phone)}</span>${email ? `<span>·</span><span>${escapeHtml(email)}</span>` : ''}
        </div>
      </div>
      <div class="flex items-center gap-2">${stageBadge(conv.client_stage)} ${demoStatusBadge(conv.demo_status)}</div>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-slate-700">Progreso del proceso</h2>
        <span class="text-xs text-slate-400">${doneCount} de ${steps.length} pasos</span>
      </div>
      <div class="flex items-start overflow-x-auto pb-1">${stepperHtml}</div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="lg:col-span-2 space-y-5">
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-4">Proyecto</h2>
          ${resumen ? `<p class="text-sm text-slate-600 mb-4 leading-relaxed">${escapeHtml(resumen)}</p>` : ''}
          ${infoRows.length ? `<div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">${infoRows.map(([k,v]) => `<div><div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">${k}</div><div class="text-slate-700 font-medium">${escapeHtml(v)}</div></div>`).join('')}</div>` : ''}
          ${funcList ? `<div class="mt-4 pt-4 border-t border-slate-100"><div class="text-xs text-slate-400 uppercase tracking-wide mb-2">Funcionalidades</div><ul class="space-y-1.5">${funcList}</ul></div>` : ''}
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-4">Conversación (${(conv.history||[]).length} mensajes)</h2>
          <div class="max-h-80 overflow-y-auto pr-1">${history || '<p class="text-sm text-slate-400">Sin mensajes</p>'}</div>
        </div>
      </div>

      <div class="space-y-5">
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-3">Acciones</h2>
          ${conv.demo_status === 'pending_review' ? `<a href="/admin/review/${phoneUrl}" class="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold mb-3 transition-colors">👁 Revisar demos</a>` : ''}
          ${conv.demo_status === 'changes_requested' ? `
            <a href="/admin/review/${phoneUrl}" class="flex items-center justify-center gap-2 w-full bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-xl text-sm font-semibold mb-2 transition-colors">✏ Ver / aprobar (con correcciones)</a>
            ${conv.demo_notes ? `<div class="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 mb-3 whitespace-pre-line">${escapeHtml(conv.demo_notes)}</div>` : ''}
          ` : ''}
          ${conv.report ? `<a href="/admin/client/${phoneUrl}/to-project" class="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold mb-3 transition-colors">📁 Convertir en proyecto</a>` : ''}
          <form method="POST" action="/admin/regenerate/${phoneUrl}" class="mb-3">
            <button class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">🔄 Regenerar demos</button>
          </form>
          <a href="https://wa.me/${phoneSlug(phone)}" target="_blank" class="flex items-center justify-center gap-2 w-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50 py-2.5 rounded-xl text-sm font-medium mb-2 transition-colors">💬 Abrir en WhatsApp</a>
          ${demoLinks}
          ${conv.drive_folder_id ? `<a href="https://drive.google.com/drive/folders/${conv.drive_folder_id}" target="_blank" class="flex items-center justify-center gap-2 w-full border border-slate-200 text-slate-600 hover:bg-slate-50 py-2 rounded-xl text-sm mt-2 transition-colors">📁 Drive</a>` : ''}
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
          <h2 class="text-sm font-semibold text-slate-700 mb-2">Historial</h2>
          <div class="max-h-64 overflow-y-auto">${timeline || '<p class="text-sm text-slate-400">Sin eventos</p>'}</div>
        </div>
      </div>
    </div>`;

  res.send(layout(nombre, body, { pendingCount, activePage: 'clients' }));
});

// ─── Convertir lead WA en proyecto ──────────────────────────────────────────

router.get('/client/:phone/to-project', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  const conv = await db.getConversation(phone);
  if (!conv?.report) return res.redirect(`/admin/client/${encodeURIComponent(phone)}`);

  const r = conv.report;
  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;

  // Pre-cargar datos del reporte en el formulario de proyecto
  const prefill = {
    client_name:   r.cliente?.nombre || '',
    client_phone:  phoneSlug(phone),
    client_email:  r.cliente?.email || '',
    title:         r.proyecto?.tipo ? `${r.proyecto.tipo} — ${r.cliente?.nombre || ''}`.trim() : '',
    type:          r.proyecto?.tipo || '',
    description:   [r.proyecto?.descripcion, r.resumen_ejecutivo].filter(Boolean).join('\n\n'),
    budget:        r.requisitos?.presupuesto || '',
    budget_status: 'not_quoted',
    status:        'planning',
    notes:         r.requisitos?.notas_adicionales || '',
    tasks: (r.proyecto?.funcionalidades || []).map(f => ({
      text: f, done: false, priority: 'medium', assignee: 'david',
    })),
  };

  const nombre = r.cliente?.nombre || phone;
  const body = `
    <div class="mb-5 flex items-center gap-3">
      <a href="/admin/client/${encodeURIComponent(phone)}" class="text-sm text-slate-500 hover:text-blue-600">← ${escapeHtml(nombre)}</a>
      <span class="text-slate-300">/</span>
      <span class="text-sm text-slate-500">Convertir en proyecto</span>
    </div>
    <div class="flex items-center gap-3 mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Nuevo proyecto</h1>
      <span class="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">Pre-cargado del lead WA</span>
    </div>
    ${projectForm(prefill, '/admin/projects', 'Crear proyecto')}`;

  res.send(layout('Nuevo proyecto', body, { pendingCount, activePage: 'projects' }));
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
              <textarea name="notes" rows="3" placeholder="Ej: Cambiar los colores a azul y blanco. El título principal debería decir 'Bienvenido a...'."
                class="w-full border border-violet-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 mb-3 bg-white"></textarea>
              <button class="w-full bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">Guardar correcciones</button>
            </form>
          </div>
        </details>

        <!-- Opción 2: Rechazar -->
        <form method="POST" action="/admin/reject/${phoneUrl}">
          <button class="w-full px-4 py-3 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 text-sm font-medium transition-colors text-left">
            ✗ Rechazar y descartar esta demo
          </button>
        </form>

        <!-- Opción 3: Aprobar -->
        <form method="POST" action="/admin/approve/${phoneUrl}">
          <button class="w-full px-6 py-3.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-semibold transition-colors">
            ✓ Aprobar y enviar al cliente ahora
          </button>
        </form>
      </div>
    </div>`;

  res.send(layout('Revisar demos', body, { pendingCount, activePage: 'clients' }));
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
  orchestrator.sendApprovedDemoToClient(phone).catch(err => console.error('Error enviando demo:', err));
  res.redirect(`/admin/client/${encodeURIComponent(phone)}`);
});

router.post('/reject/:phone', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  await db.updateDemoStatus(phone, 'rejected');
  await db.appendTimelineEvent(phone, { event: 'demo_rejected', note: 'Rechazado desde el panel' });
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

router.post('/notes/:phone', requireAuth, async (req, res) => {
  await db.setNotes(req.params.phone, req.body.notes || '');
  res.redirect(`/admin/client/${encodeURIComponent(req.params.phone)}`);
});

// ─── Projects list ───────────────────────────────────────────────────────────

router.get('/projects', requireAuth, async (req, res) => {
  const filter = req.query.status || 'all';
  const search = (req.query.q || '').toLowerCase();
  let projects = await db.listProjects();
  const allProjects = projects;
  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;

  if (search) projects = projects.filter(p =>
    p.client_name.toLowerCase().includes(search) || p.title.toLowerCase().includes(search) || p.type.toLowerCase().includes(search));
  if (filter !== 'all') projects = projects.filter(p => p.status === filter);

  const tabs = [{ key: 'all', label: 'Todos', count: allProjects.length },
    ...PROJECT_STATUS.map(s => ({ key: s.key, label: s.label, count: allProjects.filter(p => p.status === s.key).length }))
  ].filter(t => t.key === 'all' || t.count > 0);

  const tabHtml = tabs.map(t => `
    <a href="/admin/projects?status=${t.key}${search ? '&q=' + encodeURIComponent(search) : ''}"
      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === t.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}">
      ${t.label} <span class="text-xs ${filter === t.key ? 'opacity-70' : 'text-slate-400'}">${t.count}</span>
    </a>`).join('');

  const cards = projects.map(p => {
    const tasks = p.tasks || [];
    const doneTasks = tasks.filter(t => t.done).length;
    const pendingTasks = tasks.filter(t => !t.done);
    const pct = tasks.length > 0 ? Math.round(doneTasks / tasks.length * 100) : 0;
    return `
      <div class="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer group" onclick="location.href='/admin/projects/${p.id}'">
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1 min-w-0 pr-3">
            <div class="font-semibold text-slate-800 truncate">${escapeHtml(p.title || p.client_name)}</div>
            <div class="text-xs text-slate-400 mt-0.5">${escapeHtml(p.client_name)}${p.client_email ? ` · ${escapeHtml(p.client_email)}` : ''}</div>
          </div>
          <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
            ${projectStatusBadge(p.status)}
            ${budgetStatusBadge(p.budget_status)}
          </div>
        </div>
        ${p.description ? `<p class="text-xs text-slate-500 mb-3 line-clamp-2">${escapeHtml(p.description)}</p>` : ''}
        ${pendingTasks.length > 0 ? `
          <div class="mb-3">
            ${pendingTasks.slice(0, 3).map(t => `
              <div class="flex items-start gap-2 text-xs text-slate-600 mb-1">
                <span class="text-orange-400 mt-0.5">●</span>
                <span class="truncate">${escapeHtml(t.text)}</span>
                ${t.assignee ? `<span class="ml-auto text-slate-400 flex-shrink-0">${t.assignee}</span>` : ''}
              </div>`).join('')}
            ${pendingTasks.length > 3 ? `<div class="text-xs text-slate-400 mt-1">+${pendingTasks.length - 3} más</div>` : ''}
          </div>` : ''}
        ${tasks.length > 0 ? `
          <div class="flex items-center gap-2 mt-2">
            <div class="flex-1 bg-slate-100 rounded-full h-1.5">
              <div class="h-1.5 rounded-full bg-blue-500" style="width:${pct}%"></div>
            </div>
            <span class="text-xs text-slate-400">${doneTasks}/${tasks.length} tareas</span>
          </div>` : ''}
        <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <span class="text-xs text-slate-400">${timeAgo(p.updated_at)}</span>
          ${p.budget ? `<span class="text-xs font-semibold text-slate-700">${escapeHtml(p.budget)}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  const body = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Proyectos</h1>
      <a href="/admin/projects/new" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">+ Nuevo proyecto</a>
    </div>
    <div class="flex items-center gap-3 mb-4">
      <form method="GET" action="/admin/projects" class="flex-1">
        <input type="hidden" name="status" value="${escapeHtml(filter)}">
        <input type="text" name="q" value="${escapeHtml(search)}" placeholder="Buscar por cliente, título o tipo..."
          class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      </form>
    </div>
    <div class="flex items-center gap-1.5 mb-5 flex-wrap">${tabHtml}</div>
    ${projects.length === 0
      ? `<div class="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div class="text-4xl mb-3">📁</div>
          <div class="text-slate-600 font-medium mb-1">Sin proyectos todavía</div>
          <div class="text-slate-400 text-sm mb-4">Agregá proyectos para llevar un seguimiento de tu trabajo</div>
          <a href="/admin/projects/new" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">+ Nuevo proyecto</a>
        </div>`
      : `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${cards}</div>`}`;

  res.send(layout('Proyectos', body, { pendingCount, activePage: 'projects' }));
});

// ─── New project form ─────────────────────────────────────────────────────────

function projectForm(data = {}, action = '/admin/projects', btnLabel = 'Crear proyecto') {
  const statusOpts = PROJECT_STATUS.map(s =>
    `<option value="${s.key}" ${(data.status || 'planning') === s.key ? 'selected' : ''}>${s.label}</option>`).join('');
  const budgetOpts = BUDGET_STATUS.map(s =>
    `<option value="${s.key}" ${(data.budget_status || 'not_quoted') === s.key ? 'selected' : ''}>${s.label}</option>`).join('');

  const tasks = data.tasks || [];

  return `
    <form method="POST" action="${action}" id="projectForm">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2 space-y-5">

          <div class="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 class="text-sm font-semibold text-slate-700 mb-4">Datos del cliente</h2>
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2 lg:col-span-1">
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
              <div class="grid grid-cols-2 gap-4">
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
          <div class="flex items-center gap-2 mt-1.5">
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
          </div>
        </div>
        <button type="button" onclick="removeTask(\${i})" class="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 text-lg leading-none mt-0.5">×</button>
      </div>\`;
    }

    function addTask() {
      const task = { text: '', done: false, priority: 'medium', assignee: '' };
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
      });
      document.getElementById('tasksInput').value = JSON.stringify(tasks);
    }

    document.addEventListener('input', e => { if (e.target.closest('.task-row')) saveTasks(); });
    document.addEventListener('change', e => { if (e.target.closest('.task-row')) saveTasks(); });
    document.getElementById('projectForm').addEventListener('submit', saveTasks);
    </script>`;
}

function taskRowHtml(task, i) {
  const pOpts = [['medium','Prioridad media'],['high','Alta prioridad'],['low','Baja prioridad']];
  const aOpts = [['','Sin asignar'],['david','David'],['hermana','Hermana'],['cliente','Cliente']];
  return `<div class="flex items-start gap-2 bg-slate-50 rounded-xl p-3 task-row" data-idx="${i}">
    <input type="checkbox" class="task-done mt-0.5 flex-shrink-0 w-4 h-4 rounded accent-blue-600" ${task.done ? 'checked' : ''}>
    <div class="flex-1 min-w-0">
      <input type="text" class="task-text w-full bg-transparent text-sm text-slate-700 focus:outline-none placeholder-slate-400 border-b border-transparent focus:border-slate-300" value="${escapeHtml(task.text || '')}" placeholder="Describí la tarea...">
      <div class="flex items-center gap-2 mt-1.5">
        <select class="task-priority text-xs border-0 bg-transparent text-slate-400 focus:outline-none cursor-pointer">
          ${pOpts.map(([v,l]) => `<option value="${v}" ${(task.priority||'medium')===v?'selected':''}>${l}</option>`).join('')}
        </select>
        <select class="task-assignee text-xs border-0 bg-transparent text-slate-400 focus:outline-none cursor-pointer">
          ${aOpts.map(([v,l]) => `<option value="${v}" ${(task.assignee||'')===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
    </div>
    <button type="button" onclick="removeTask(${i})" class="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 text-lg leading-none mt-0.5">×</button>
  </div>`;
}

router.get('/projects/new', requireAuth, async (req, res) => {
  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;
  const body = `
    <div class="mb-5"><a href="/admin/projects" class="text-sm text-slate-500 hover:text-blue-600">← Proyectos</a></div>
    <h1 class="text-2xl font-bold text-slate-900 mb-6">Nuevo proyecto</h1>
    ${projectForm({}, '/admin/projects', 'Crear proyecto')}`;
  res.send(layout('Nuevo proyecto', body, { pendingCount, activePage: 'projects' }));
});

router.post('/projects', requireAuth, async (req, res) => {
  let tasks = [];
  try { tasks = JSON.parse(req.body.tasks || '[]'); } catch (e) {}
  const id = await db.createProject({ ...req.body, tasks });
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

router.get('/projects/:id', requireAuth, async (req, res) => {
  const project = await db.getProject(req.params.id);
  if (!project) return res.status(404).send(layout('No encontrado', '<p class="p-4 text-slate-500">Proyecto no encontrado.</p>'));

  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;
  const tasks = project.tasks || [];

  // Archivos del proyecto
  const projectFilesDir = path.join(PROJECT_FILES_DIR, project.id);
  const projectFiles = fs.existsSync(projectFilesDir)
    ? fs.readdirSync(projectFilesDir).map(name => ({ name, size: fs.statSync(path.join(projectFilesDir, name)).size }))
    : [];
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
        </div>
      </div>
    </form>`).join('');

  const body = `
    <div class="mb-5 flex items-center justify-between">
      <a href="/admin/projects" class="text-sm text-slate-500 hover:text-blue-600">← Proyectos</a>
      <div class="flex gap-3">
        <a href="/admin/projects/${project.id}/edit" class="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm transition-colors">Editar</a>
        <form method="POST" action="/admin/projects/${project.id}/delete" onsubmit="return confirm('¿Eliminar este proyecto?')">
          <button class="border border-red-200 text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl text-sm transition-colors">Eliminar</button>
        </form>
      </div>
    </div>

    <div class="flex items-start justify-between mb-5">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">${escapeHtml(project.title || project.client_name)}</h1>
        <div class="text-sm text-slate-400 mt-0.5">${escapeHtml(project.client_name)}${project.client_email ? ` · ${escapeHtml(project.client_email)}` : ''}${project.client_phone ? ` · ${escapeHtml(project.client_phone)}` : ''}</div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        ${projectStatusBadge(project.status)}
        ${budgetStatusBadge(project.budget_status)}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="lg:col-span-2 space-y-5">

        ${project.description ? `
          <div class="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 class="text-sm font-semibold text-slate-700 mb-3">Descripción</h2>
            <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">${escapeHtml(project.description)}</p>
          </div>` : ''}

        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-slate-700">Tareas y pendientes</h2>
            <div class="flex items-center gap-3">
              ${tasks.length > 0 ? `<span class="text-xs text-slate-400">${doneTasks}/${tasks.length} completadas (${pct}%)</span>` : ''}
              <a href="/admin/projects/${project.id}/edit" class="text-xs text-blue-600 hover:underline">Editar tareas →</a>
            </div>
          </div>
          ${tasks.length > 0 ? `
            <div class="bg-slate-100 rounded-full h-2 mb-4">
              <div class="h-2 rounded-full bg-blue-500 transition-all" style="width:${pct}%"></div>
            </div>
            ${taskRows}` : `
            <div class="text-center py-8">
              <div class="text-2xl mb-2">✅</div>
              <p class="text-sm text-slate-400">Sin tareas. <a href="/admin/projects/${project.id}/edit" class="text-blue-600 hover:underline">Agregar tareas</a></p>
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
      </div>

      <div class="space-y-5">
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-4">Detalles</h2>
          <div class="space-y-3 text-sm">
            ${project.type ? `<div><div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Tipo</div><div class="text-slate-700 font-medium">${escapeHtml(project.type)}</div></div>` : ''}
            ${project.budget ? `<div><div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Presupuesto</div><div class="text-slate-700 font-semibold text-base">${escapeHtml(project.budget)}</div></div>` : ''}
            <div><div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Estado</div>${projectStatusBadge(project.status)}</div>
            <div><div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Presupuesto</div>${budgetStatusBadge(project.budget_status)}</div>
            <div><div class="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Última actividad</div><div class="text-slate-600">${timeAgo(project.updated_at)}</div></div>
          </div>
          <div class="mt-4 pt-4 border-t border-slate-100">
            <a href="/admin/projects/${project.id}/edit" class="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">✏️ Editar proyecto</a>
          </div>
        </div>

        ${tasks.filter(t => !t.done && t.priority === 'high').length > 0 ? `
          <div class="bg-red-50 border border-red-200 rounded-2xl p-5">
            <h2 class="text-sm font-semibold text-red-700 mb-3">🔥 Alta prioridad</h2>
            <div class="space-y-2">
              ${tasks.filter(t => !t.done && t.priority === 'high').map(t => `
                <div class="text-xs text-red-600">• ${escapeHtml(t.text)}</div>`).join('')}
            </div>
          </div>` : ''}
      </div>
    </div>`;

  res.send(layout(project.title || project.client_name, body, { pendingCount, activePage: 'projects' }));
});

// ─── Edit project ─────────────────────────────────────────────────────────────

router.get('/projects/:id/edit', requireAuth, async (req, res) => {
  const project = await db.getProject(req.params.id);
  if (!project) return res.redirect('/admin/projects');
  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;
  const body = `
    <div class="mb-5"><a href="/admin/projects/${project.id}" class="text-sm text-slate-500 hover:text-blue-600">← ${escapeHtml(project.title || project.client_name)}</a></div>
    <h1 class="text-2xl font-bold text-slate-900 mb-6">Editar proyecto</h1>
    ${projectForm(project, `/admin/projects/${project.id}/update`, 'Guardar cambios')}`;
  res.send(layout('Editar proyecto', body, { pendingCount, activePage: 'projects' }));
});

router.post('/projects/:id/update', requireAuth, async (req, res) => {
  let tasks = [];
  try { tasks = JSON.parse(req.body.tasks || '[]'); } catch (e) {}
  await db.updateProject(req.params.id, { ...req.body, tasks });
  res.redirect(`/admin/projects/${req.params.id}`);
});

router.post('/projects/:id/add-update', requireAuth, async (req, res) => {
  const text = (req.body.text || '').trim();
  if (text) await db.addProjectUpdate(req.params.id, text);
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
  const filePath = path.join(PROJECT_FILES_DIR, req.params.id, req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.redirect(`/admin/projects/${req.params.id}`);
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

module.exports = router;
