const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const db = require('./db');

const APP_VERSION = '1.2.0'; // Actualizar con cada deploy relevante
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

const PROJECT_CATEGORIES = [
  { key: 'cliente',     label: 'Cliente',     color: '#3b82f6', badge: 'bg-blue-100 text-blue-700',     dot: '🔵' },
  { key: 'personal',   label: 'Personal',    color: '#8b5cf6', badge: 'bg-violet-100 text-violet-700',  dot: '🟣' },
  { key: 'ventas',     label: 'Ventas',      color: '#10b981', badge: 'bg-emerald-100 text-emerald-700',dot: '🟢' },
  { key: 'desarrollo', label: 'Desarrollo',  color: '#f59e0b', badge: 'bg-amber-100 text-amber-700',    dot: '🟡' },
  { key: 'diseño',     label: 'Diseño',      color: '#ec4899', badge: 'bg-pink-100 text-pink-700',      dot: '🩷' },
  { key: 'otro',       label: 'Otro',        color: '#64748b', badge: 'bg-slate-100 text-slate-600',    dot: '⚪' },
];

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

function layout(title, body, { pendingCount = 0, activePage = '', user = null } = {}) {
  const navItem = (href, icon, label, page) => {
    const active = activePage === page;
    return `<a href="${href}" class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${active ? 'bg-blue-600/90 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}">
      <span class="text-[15px] leading-none flex-shrink-0 ${active ? 'opacity-100' : 'opacity-60'}">${icon}</span>
      <span class="flex-1">${label}</span>
      ${page === 'clients' && pendingCount > 0 ? `<span class="bg-orange-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center animate-pulse">${pendingCount}</span>` : ''}
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
        <div class="min-w-0 flex-1">
          <div class="text-xs font-semibold text-slate-200 truncate leading-tight">${escapeHtml(userName || 'David Taranto')}</div>
          ${userEmail ? `<div class="text-[10px] text-slate-500 truncate leading-tight">${escapeHtml(userEmail)}</div>` : '<div class="text-[10px] text-slate-500 leading-tight">Admin</div>'}
        </div>
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · DT Systems</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-track{background:#f1f5f9}
    ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
    ::-webkit-scrollbar-thumb:hover{background:#94a3b8}
    @keyframes spin{to{transform:rotate(360deg)}}
    .spin{animation:spin 1s linear infinite}
    body{font-feature-settings:'cv02','cv03','cv04','cv11';-webkit-font-smoothing:antialiased}
    .nav-active{background:rgba(59,130,246,0.15)!important}
  </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen" style="display:flex">
  <aside style="width:240px;min-height:100vh;position:fixed;top:0;left:0;z-index:20" class="bg-[#0f172a] flex flex-col border-r border-white/5">
    <!-- Brand -->
    <div class="px-4 py-4 border-b border-white/5">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-900/40">
          <span class="text-white text-[11px] font-black tracking-tight">DT</span>
        </div>
        <div>
          <div class="text-sm font-bold text-white tracking-tight leading-tight">DT Systems</div>
          <div class="text-[10px] text-slate-500 leading-none mt-0.5">CRM & Proyectos · <span class="text-slate-600">v${APP_VERSION}</span></div>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-5">
      <div>
        <div class="px-2 mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">General</div>
        <div class="space-y-0.5">
          ${navItem('/admin', '📊', 'Dashboard', 'dashboard')}
        </div>
      </div>
      <div>
        <div class="px-2 mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Clientes</div>
        <div class="space-y-0.5">
          ${navItem('/admin/clients', '💬', 'Leads WA', 'clients')}
          ${navItem('/admin/clientes', '👥', 'Clientes', 'clientes')}
        </div>
      </div>
      <div>
        <div class="px-2 mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Trabajo</div>
        <div class="space-y-0.5">
          ${navItem('/admin/projects', '📁', 'Proyectos', 'projects')}
          ${navItem('/admin/tasks', '✅', 'Tareas', 'tasks')}
        </div>
      </div>
    </nav>

    <!-- User + Logout -->
    <div class="pb-3 border-t border-slate-700/40 pt-3">
      ${userBlock}
      <form method="POST" action="/admin/logout" class="px-3">
        <button class="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors w-full px-3 py-2 rounded-lg hover:bg-slate-800">
          <span>🚪</span><span>Cerrar sesión</span>
        </button>
      </form>
    </div>
  </aside>
  <div style="margin-left:240px;flex:1;min-height:100vh">
    <main class="max-w-6xl mx-auto p-6 pb-16">${body}</main>
  </div>
</body>
</html>`;
}

// ─── Login ───────────────────────────────────────────────────────────────────

const passport = require('passport');

function loginPage(errorMsg = '') {
  const googleConfigured = !!process.env.GOOGLE_CLIENT_ID;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Login · DT Systems</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gradient-to-br from-slate-900 to-slate-800 min-h-screen flex items-center justify-center">
  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <div class="text-3xl font-bold text-white tracking-tight">DT Systems</div>
      <div class="text-slate-400 text-sm mt-1">Gestión de leads y proyectos</div>
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
    { label: 'Tareas pendientes',value: pendingTasks,          icon: '✅', grad: pendingTasks > 0 ? 'from-amber-400 to-amber-500' : 'from-emerald-500 to-emerald-600', sub: 'en proyectos', href: '/admin/tasks' },
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

  const body = `
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">${(() => {
          const h = new Date().getHours();
          const name = (req.session?.user?.name || 'David').split(' ')[0];
          const greet = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
          return `${greet}, ${name} 👋`;
        })()}</h1>
        <div class="text-sm text-slate-400 mt-0.5">${new Date().toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
      </div>
    </div>
    ${alertStrip}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">${metricCards}</div>
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
          <div class="space-y-2">
            ${allPendingTasks.slice(0, 5).map(t => `
              <a href="/admin/projects/${t.projectId}" class="flex items-start gap-2.5 group py-1.5 -mx-1 px-1 rounded-lg hover:bg-slate-50 transition-colors block">
                <div class="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${t.priority === 'high' ? 'bg-red-400' : t.priority === 'medium' ? 'bg-amber-400' : 'bg-slate-300'}"></div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-slate-700 group-hover:text-blue-600 truncate">${escapeHtml(t.text)}</div>
                  <div class="text-[10px] text-slate-400 truncate">${escapeHtml(t.projectTitle)}</div>
                  ${t.due_date ? (() => {
                    const dl = Math.ceil((new Date(t.due_date) - new Date()) / 86400000);
                    const color = dl < 0 ? 'text-red-500' : dl <= 1 ? 'text-orange-500' : 'text-slate-400';
                    return `<div class="text-[10px] ${color} font-medium">📅 ${dl < 0 ? 'Vencida' : dl === 0 ? 'Hoy' : `en ${dl}d`}</div>`;
                  })() : ''}
                </div>
              </a>`).join('')}
            ${allPendingTasks.length > 5 ? `<a href="/admin/tasks" class="text-xs text-slate-400 hover:text-blue-600 pt-1 block">+${allPendingTasks.length - 5} más →</a>` : ''}
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

  res.send(layout('Leads WA', body, { pendingCount: pendingReview.length, activePage: 'clients', user: req.session?.user }));
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
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-2">Historial</h2>
          <div class="max-h-64 overflow-y-auto">${timeline || '<p class="text-sm text-slate-400">Sin eventos</p>'}</div>
        </div>
      </div>
    </div>`;

  res.send(layout(nombre, body, { pendingCount, activePage: 'clients', user: req.session?.user }));
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
  const clientList = await db.listClientRecords();
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
    ${projectForm(prefill, '/admin/projects', 'Crear proyecto', clientList)}`;

  res.send(layout('Nuevo proyecto', body, { pendingCount, activePage: 'projects', user: req.session?.user }));
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

// ─── All tasks ───────────────────────────────────────────────────────────────

router.get('/tasks', requireAuth, async (req, res) => {
  const projects = await db.listProjects();
  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;

  const filter = req.query.filter || 'all'; // all | high | overdue | today

  // Gather all pending tasks with project context
  let taskGroups = projects
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
    overdueCount > 0 ? { key: 'overdue', label: `⚠ Vencidas (${overdueCount})` } : null,
    todayCount > 0 ? { key: 'today', label: `📅 Hoy (${todayCount})` } : null,
    { key: 'david', label: 'David' },
    { key: 'hermana', label: 'Hermana' },
  ].filter(Boolean).map(t => `<a href="/admin/tasks?filter=${t.key}" class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === t.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}">${t.label}</a>`).join('');

  const priorityDot = p => {
    if (p === 'high') return '<span class="w-2 h-2 rounded-full bg-red-400 flex-shrink-0 mt-1"></span>';
    if (p === 'medium') return '<span class="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1"></span>';
    return '<span class="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0 mt-1"></span>';
  };

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
              return `<span class="text-[10px] ${dl < 0 ? 'bg-red-100 text-red-600' : dl <= 3 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'} px-2 py-0.5 rounded-full font-medium">📅 ${dl < 0 ? 'Vencida' : dl === 0 ? 'Hoy' : `${dl}d`}</span>`;
            })() : ''}
          </div>
          ${g.project.client_name && g.project.title ? `<div class="text-xs text-slate-400">${escapeHtml(g.project.client_name)}</div>` : ''}
        </div>
        <a href="/admin/projects/${g.project.id}" class="text-xs text-blue-600 hover:underline flex-shrink-0">Ver proyecto →</a>
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
                    return `<span class="text-[10px] ${color} font-medium ml-1">📅 ${label}</span>`;
                  })() : ''}
                </div>
              </div>
            </div>
          </form>`).join('')}
      </div>
    </div>`).join('');

  const body = `
    <div class="flex items-center gap-3 mb-6">
      <div class="flex-1">
        <h1 class="text-2xl font-bold text-slate-900">Tareas pendientes</h1>
        <div class="text-sm text-slate-400 mt-0.5">${totalPending} tarea${totalPending !== 1 ? 's' : ''} sin completar en ${projects.filter(p => (p.tasks||[]).some(t=>!t.done)).length} proyectos</div>
      </div>
    </div>
    <div class="flex items-center gap-1.5 mb-5 flex-wrap">${filterTabs}</div>
    ${taskGroups.length > 0 ? groups : `
      <div class="text-center py-20">
        <div class="text-5xl mb-4">✅</div>
        <h3 class="text-lg font-semibold text-slate-700 mb-2">Todo al día</h3>
        <p class="text-sm text-slate-400">No hay tareas pendientes${filter !== 'all' ? ' con este filtro' : ''}.</p>
      </div>`}`;

  res.send(layout('Tareas pendientes', body, { pendingCount, activePage: 'tasks', user: req.session?.user }));
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
  if (filter.startsWith('cat_')) {
    const catKey = filter.slice(4);
    projects = projects.filter(p => (p.category || 'cliente') === catKey);
  } else if (filter !== 'all') {
    projects = projects.filter(p => p.status === filter);
  }

  const tabs = [
    { key: 'all', label: 'Todos', count: allProjects.length },
    ...PROJECT_CATEGORIES.map(c => ({ key: `cat_${c.key}`, label: `${c.dot} ${c.label}`, count: allProjects.filter(p => (p.category || 'cliente') === c.key).length })),
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
            return `<span class="text-[10px] px-2 py-0.5 rounded-full font-medium ${color}">📅 ${dl < 0 ? `Vencida` : dl === 0 ? 'Hoy' : `${dl}d`}</span>`;
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
            ${pendingTasks.length > 2 ? `<div class="text-xs text-slate-400">+${pendingTasks.length - 2} más</div>` : ''}
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

  const emptyState = `
    <div class="text-center py-20">
      <div class="text-5xl mb-4">📋</div>
      <h3 class="text-lg font-semibold text-slate-700 mb-2">Sin proyectos todavía</h3>
      <p class="text-sm text-slate-400 mb-6">Creá tu primer proyecto o convertí un lead de WhatsApp.</p>
      <a href="/admin/projects/new" class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">+ Nuevo proyecto</a>
    </div>`;

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
    ${(() => {
      const totalBudget = allProjects.filter(p => p.budget).length;
      const inProgress = allProjects.filter(p => ['in_progress','review'].includes(p.status)).length;
      const completed = allProjects.filter(p => p.status === 'done').length;
      const planning = allProjects.filter(p => p.status === 'planning').length;
      return `<div class="flex items-center gap-4 mb-5 text-xs text-slate-500">
        <span>${allProjects.length} proyecto${allProjects.length !== 1 ? 's' : ''} en total</span>
        <span class="text-slate-200">·</span>
        <span class="text-amber-600 font-medium">${planning} en planificación</span>
        <span class="text-slate-200">·</span>
        <span class="text-blue-600 font-medium">${inProgress} en progreso</span>
        <span class="text-slate-200">·</span>
        <span class="text-emerald-600 font-medium">${completed} entregados</span>
      </div>`;
    })()}
    <div class="flex items-center gap-1.5 mb-5 flex-wrap">${tabHtml}</div>
    ${cards ? `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${cards}</div>` : emptyState}`;

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
              <div class="grid grid-cols-2 gap-4">
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
  const id = await db.createProject({ ...req.body, tasks, is_personal: req.body.category === 'personal', deadline: req.body.deadline || null, client_id: req.body.client_id || '' });
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
  if (!project) return res.status(404).send(layout('No encontrado', '<p class="p-4 text-slate-500">Proyecto no encontrado.</p>', { user: req.session?.user }));

  const pendingCount = (await db.listAllClients()).filter(c => c.demo_status === 'pending_review').length;
  // Load linked client if exists
  const linkedClient = project.client_id ? await db.getClientRecord(project.client_id) : null;
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
    <div class="mb-5 flex items-center justify-between">
      <nav class="flex items-center gap-1.5 text-sm text-slate-400">
        <a href="/admin/projects" class="hover:text-blue-600 transition-colors">Proyectos</a>
        <span>/</span>
        <span class="text-slate-600 truncate max-w-xs">${escapeHtml(project.title || project.client_name)}</span>
      </nav>
      <div class="flex gap-3">
        <a href="/admin/projects/${project.id}/edit" class="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm transition-colors">Editar</a>
        <form method="POST" action="/admin/projects/${project.id}/delete" onsubmit="return confirm('¿Eliminar este proyecto?')">
          <button class="border border-red-200 text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl text-sm transition-colors">Eliminar</button>
        </form>
      </div>
    </div>

    <div class="flex items-start justify-between mb-5">
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
        ${linkedClient ? `
  <div class="bg-white rounded-2xl border border-slate-200 p-4">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Cliente vinculado</h2>
      <a href="/admin/clientes/${linkedClient.id}" class="text-xs text-blue-600 hover:underline">Ver →</a>
    </div>
    <div class="flex items-center gap-2.5">
      ${(() => {
        const colors = ['bg-blue-500','bg-purple-500','bg-emerald-500','bg-orange-500','bg-rose-500'];
        const bg = colors[linkedClient.name.split('').reduce((a,c) => a + c.charCodeAt(0), 0) % colors.length];
        return `<div class="w-8 h-8 rounded-full ${bg} flex items-center justify-center text-white font-bold text-sm flex-shrink-0">${(linkedClient.name[0]||'?').toUpperCase()}</div>`;
      })()}
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-slate-800 truncate">${escapeHtml(linkedClient.name)}</div>
        ${linkedClient.company ? `<div class="text-xs text-slate-400 truncate">${escapeHtml(linkedClient.company)}</div>` : ''}
      </div>
    </div>
    ${linkedClient.phone ? `<a href="tel:${escapeHtml(linkedClient.phone)}" class="text-xs text-blue-600 hover:underline mt-2 block">${escapeHtml(linkedClient.phone)}</a>` : ''}
    ${linkedClient.email ? `<a href="mailto:${escapeHtml(linkedClient.email)}" class="text-xs text-slate-400 hover:underline truncate block">${escapeHtml(linkedClient.email)}</a>` : ''}
  </div>` : ''}
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
  await db.updateProject(req.params.id, { ...req.body, tasks, is_personal: req.body.category === 'personal', deadline: req.body.deadline || null, client_id: req.body.client_id || '' });
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
  const filePath = path.join(PROJECT_FILES_DIR, req.params.id, req.params.filename);
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
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
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
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Clientes</h1>
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
      <table class="w-full">
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
  const id = await db.createClientRecord(req.body);
  res.redirect(`/admin/clientes/${id}`);
});

router.get('/clientes/:id', requireAuth, async (req, res) => {
  const client = await db.getClientRecord(req.params.id);
  if (!client) return res.status(404).send(layout('No encontrado', '<p class="p-4 text-slate-500">Cliente no encontrado.</p>', {}));

  const clientProjects = await db.getProjectsByClientId(req.params.id);
  const allWa = await db.listAllClients();
  const pendingCount = allWa.filter(c => c.demo_status === 'pending_review').length;

  const initial = (client.name[0] || '?').toUpperCase();
  const avatarColors = ['bg-blue-500','bg-purple-500','bg-emerald-500','bg-orange-500','bg-rose-500','bg-indigo-500'];
  const avatarColor = avatarColors[client.name.split('').reduce((a,c) => a + c.charCodeAt(0), 0) % avatarColors.length];

  const projectCards = clientProjects.map(p => {
    const cat = PROJECT_CATEGORIES.find(c => c.key === (p.category || 'cliente')) || PROJECT_CATEGORIES[0];
    const pending = (p.tasks || []).filter(t => !t.done).length;
    return `<a href="/admin/projects/${p.id}" class="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors block">
      <div class="w-2 rounded-full flex-shrink-0 self-stretch" style="background:${cat.color}"></div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-slate-800 truncate">${escapeHtml(p.title || p.client_name)}</div>
        <div class="text-xs text-slate-400 mt-0.5">${projectStatusBadge(p.status)}</div>
      </div>
      ${pending > 0 ? `<span class="text-xs text-amber-600 font-medium flex-shrink-0">${pending} tarea${pending !== 1 ? 's' : ''}</span>` : ''}
    </a>`;
  }).join('');

  // Try to find matching WA lead by phone
  const waLead = client.phone ? allWa.find(c => c.phone.includes(client.phone.replace(/\D/g, '')) || client.phone.includes(c.phone.replace(/\D/g, ''))) : null;

  const body = `
    <div class="mb-5 flex items-center justify-between">
      <nav class="flex items-center gap-1.5 text-sm text-slate-400">
        <a href="/admin/clientes" class="hover:text-blue-600">Clientes</a>
        <span>/</span>
        <span class="text-slate-600 truncate">${escapeHtml(client.name)}</span>
      </nav>
      <div class="flex gap-2">
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
            <a href="/admin/projects/new" class="text-xs text-blue-600 hover:underline">+ Nuevo proyecto →</a>
          </div>
          ${clientProjects.length > 0
            ? `<div class="space-y-2">${projectCards}</div>`
            : `<div class="text-center py-8"><div class="text-2xl mb-2">📋</div><p class="text-sm text-slate-400">Sin proyectos vinculados todavía.</p></div>`}
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

        <!-- Stats -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-700 mb-3">Resumen</h2>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-slate-500">Proyectos</span>
              <span class="font-medium">${clientProjects.length}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">En curso</span>
              <span class="font-medium">${clientProjects.filter(p => ['in_progress','review'].includes(p.status)).length}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Entregados</span>
              <span class="font-medium text-emerald-600">${clientProjects.filter(p => p.status === 'delivered').length}</span>
            </div>
            ${clientProjects.filter(p => p.budget).length > 0 ? `
            <div class="flex justify-between pt-2 border-t border-slate-100">
              <span class="text-slate-500">Proyectos con presupuesto</span>
              <span class="font-medium">${clientProjects.filter(p => p.budget).length}</span>
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
  await db.updateClientRecord(req.params.id, req.body);
  res.redirect(`/admin/clientes/${req.params.id}`);
});

router.post('/clientes/:id/notes', requireAuth, async (req, res) => {
  await db.updateClientRecord(req.params.id, { ...(await db.getClientRecord(req.params.id) || {}), notes: req.body.notes || '' });
  res.redirect(`/admin/clientes/${req.params.id}`);
});

router.post('/clientes/:id/delete', requireAuth, async (req, res) => {
  await db.deleteClientRecord(req.params.id);
  res.redirect('/admin/clientes');
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
