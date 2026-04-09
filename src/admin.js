const express = require('express');
const db = require('./db');
const orchestrator = require('./orchestrator');

const router = express.Router();

// ---------- Helpers ----------

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function phoneSlug(phone) {
  return (phone || '').replace(/[^0-9]/g, '');
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authed) return next();
  return res.redirect('/admin/login');
}

const STAGES = [
  { key: 'lead', label: 'Lead', color: 'bg-slate-200 text-slate-700' },
  { key: 'qualified', label: 'Calificado', color: 'bg-blue-100 text-blue-700' },
  { key: 'demo_pending', label: 'Demo pendiente', color: 'bg-amber-100 text-amber-700' },
  { key: 'demo_sent', label: 'Demo enviado', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'negotiating', label: 'Negociando', color: 'bg-purple-100 text-purple-700' },
  { key: 'won', label: 'Ganado', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'lost', label: 'Perdido', color: 'bg-rose-100 text-rose-700' },
  { key: 'dormant', label: 'Dormido', color: 'bg-gray-200 text-gray-600' },
];

function stageBadge(stage) {
  const s = STAGES.find(x => x.key === stage) || STAGES[0];
  return `<span class="px-2 py-1 rounded text-xs font-medium ${s.color}">${s.label}</span>`;
}

function demoStatusBadge(status) {
  const map = {
    none: { label: '—', color: 'bg-gray-100 text-gray-500' },
    generating: { label: 'Generando...', color: 'bg-yellow-100 text-yellow-700' },
    pending_review: { label: 'Esperando review', color: 'bg-orange-100 text-orange-700' },
    approved: { label: 'Aprobado', color: 'bg-green-100 text-green-700' },
    sent: { label: 'Enviado', color: 'bg-indigo-100 text-indigo-700' },
    rejected: { label: 'Rechazado', color: 'bg-red-100 text-red-700' },
  };
  const s = map[status] || map.none;
  return `<span class="px-2 py-1 rounded text-xs font-medium ${s.color}">${s.label}</span>`;
}

function layout(title, body) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · WPanalista Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen">
  <nav class="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
    <div class="flex items-center gap-6">
      <a href="/admin" class="font-bold text-lg text-blue-600">WPanalista</a>
      <a href="/admin" class="text-sm text-slate-600 hover:text-blue-600">Clientes</a>
    </div>
    <form method="POST" action="/admin/logout"><button class="text-sm text-slate-500 hover:text-red-600">Salir</button></form>
  </nav>
  <main class="max-w-6xl mx-auto p-6">
    ${body}
  </main>
</body>
</html>`;
}

// ---------- Login ----------

router.get('/login', (req, res) => {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Login · WPanalista</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-slate-50 min-h-screen flex items-center justify-center">
  <form method="POST" action="/admin/login" class="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-96">
    <h1 class="text-2xl font-bold text-blue-600 mb-6">WPanalista Admin</h1>
    <label class="block text-sm text-slate-600 mb-2">Contraseña</label>
    <input type="password" name="password" class="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-blue-500" autofocus>
    ${req.query.error ? '<p class="text-red-500 text-sm mb-2">Contraseña incorrecta</p>' : ''}
    <button class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Entrar</button>
  </form>
</body></html>`;
  res.send(html);
});

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password && password === process.env.ADMIN_PASSWORD) {
    req.session.authed = true;
    return res.redirect('/admin');
  }
  res.redirect('/admin/login?error=1');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ---------- Lista de clientes ----------

router.get('/', requireAuth, (req, res) => {
  const clients = db.listAllClients();

  const rows = clients.map(c => {
    const nombre = c.report?.cliente?.nombre || c.context?.nombre || '—';
    const tipo = c.report?.proyecto?.tipo || '—';
    const updated = c.updated_at ? new Date(c.updated_at + 'Z').toLocaleString('es-AR') : '';
    const phone = escapeHtml(c.phone);
    const phoneUrl = encodeURIComponent(c.phone);
    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="px-4 py-3">
          <div class="font-medium">${escapeHtml(nombre)}</div>
          <div class="text-xs text-slate-500">${phone}</div>
        </td>
        <td class="px-4 py-3 text-sm">${escapeHtml(tipo)}</td>
        <td class="px-4 py-3">${stageBadge(c.client_stage)}</td>
        <td class="px-4 py-3">${demoStatusBadge(c.demo_status)}</td>
        <td class="px-4 py-3 text-xs text-slate-500">${updated}</td>
        <td class="px-4 py-3 text-right">
          <a href="/admin/client/${phoneUrl}" class="text-blue-600 hover:underline text-sm">Abrir</a>
          ${c.demo_status === 'pending_review' ? `
            <a href="/admin/review/${phoneUrl}" class="ml-3 text-orange-600 hover:underline text-sm font-semibold">Revisar</a>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');

  const stageCounts = STAGES.map(s => {
    const count = clients.filter(c => c.client_stage === s.key).length;
    return `<div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-blue-500"></span><span class="text-sm text-slate-600">${s.label}:</span> <span class="font-semibold">${count}</span></div>`;
  }).join('');

  const body = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Clientes</h1>
      <div class="text-sm text-slate-500">${clients.length} en total</div>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
      ${stageCounts}
    </div>
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table class="w-full">
        <thead class="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Proyecto</th>
            <th class="px-4 py-3">Etapa</th>
            <th class="px-4 py-3">Demo</th>
            <th class="px-4 py-3">Última actividad</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td class="px-4 py-8 text-center text-slate-400" colspan="6">Sin clientes todavía</td></tr>'}</tbody>
      </table>
    </div>
  `;

  res.send(layout('Clientes', body));
});

// ---------- Ficha de cliente ----------

router.get('/client/:phone', requireAuth, (req, res) => {
  const phone = req.params.phone;
  const conv = db.getConversation(phone);
  if (!conv) return res.status(404).send(layout('No encontrado', '<p>Cliente no encontrado</p>'));

  const nombre = conv.report?.cliente?.nombre || conv.context?.nombre || '—';
  const email = conv.report?.cliente?.email || '';
  const proyecto = conv.report?.proyecto || {};
  const requisitos = conv.report?.requisitos || {};
  const resumen = conv.report?.resumen_ejecutivo || '';

  const history = (conv.history || []).map(m => {
    const isUser = m.role === 'user';
    return `<div class="flex ${isUser ? 'justify-start' : 'justify-end'} mb-2">
      <div class="max-w-[75%] px-3 py-2 rounded-lg ${isUser ? 'bg-slate-100' : 'bg-blue-100'}">
        <div class="text-xs text-slate-500 mb-1">${isUser ? 'Cliente' : 'Asistente'}</div>
        <div class="text-sm whitespace-pre-wrap">${escapeHtml(m.content)}</div>
      </div>
    </div>`;
  }).join('');

  const timeline = (conv.timeline || []).slice().reverse().map(ev => {
    const date = new Date(ev.date).toLocaleString('es-AR');
    return `<div class="flex gap-3 mb-3">
      <div class="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
      <div>
        <div class="text-sm font-medium">${escapeHtml(ev.event)}</div>
        ${ev.note ? `<div class="text-xs text-slate-500">${escapeHtml(ev.note)}</div>` : ''}
        <div class="text-xs text-slate-400">${date}</div>
      </div>
    </div>`;
  }).join('');

  const stageOptions = STAGES.map(s =>
    `<option value="${s.key}" ${s.key === conv.client_stage ? 'selected' : ''}>${s.label}</option>`
  ).join('');

  const funcList = (proyecto.funcionalidades || []).map(f => `<li>${escapeHtml(f)}</li>`).join('');

  const body = `
    <div class="mb-4">
      <a href="/admin" class="text-sm text-blue-600 hover:underline">← Volver a clientes</a>
    </div>
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">${escapeHtml(nombre)}</h1>
        <div class="text-sm text-slate-500">${escapeHtml(phone)}${email ? ' · ' + escapeHtml(email) : ''}</div>
      </div>
      <div class="flex gap-2">
        ${stageBadge(conv.client_stage)}
        ${demoStatusBadge(conv.demo_status)}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-white rounded-xl border border-slate-200 p-5">
          <h2 class="font-semibold text-slate-700 mb-3">Resumen del proyecto</h2>
          <p class="text-sm text-slate-600 mb-3">${escapeHtml(resumen || '—')}</p>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div><span class="text-slate-500">Tipo:</span> ${escapeHtml(proyecto.tipo || '—')}</div>
            <div><span class="text-slate-500">Plataforma:</span> ${escapeHtml(proyecto.plataforma || '—')}</div>
            <div><span class="text-slate-500">Estado:</span> ${escapeHtml(proyecto.estado_actual || '—')}</div>
            <div><span class="text-slate-500">Stack:</span> ${escapeHtml(requisitos.stack_sugerido || '—')}</div>
            <div><span class="text-slate-500">Presupuesto:</span> ${escapeHtml(requisitos.presupuesto || '—')}</div>
            <div><span class="text-slate-500">Plazo:</span> ${escapeHtml(requisitos.plazo || '—')}</div>
          </div>
          ${funcList ? `<div class="mt-3"><div class="text-sm text-slate-500 mb-1">Funcionalidades:</div><ul class="list-disc list-inside text-sm text-slate-700">${funcList}</ul></div>` : ''}
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-5">
          <h2 class="font-semibold text-slate-700 mb-3">Conversación</h2>
          <div class="max-h-96 overflow-y-auto">${history || '<p class="text-sm text-slate-400">Sin mensajes</p>'}</div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="bg-white rounded-xl border border-slate-200 p-5">
          <h2 class="font-semibold text-slate-700 mb-3">Acciones</h2>
          <form method="POST" action="/admin/stage/${encodeURIComponent(phone)}" class="mb-3">
            <label class="text-xs text-slate-500">Cambiar etapa</label>
            <select name="stage" class="w-full border border-slate-300 rounded px-2 py-1 text-sm mt-1">${stageOptions}</select>
            <button class="mt-2 w-full bg-slate-700 text-white py-1.5 rounded text-sm">Guardar etapa</button>
          </form>
          ${conv.demo_status === 'pending_review' ? `
            <a href="/admin/review/${encodeURIComponent(phone)}" class="block text-center bg-orange-500 text-white py-2 rounded text-sm font-semibold mb-2">Revisar demos</a>
          ` : ''}
          <form method="POST" action="/admin/regenerate/${encodeURIComponent(phone)}">
            <button class="w-full bg-blue-600 text-white py-2 rounded text-sm">Regenerar demos</button>
          </form>
          ${conv.drive_folder_id ? `
            <a href="https://drive.google.com/drive/folders/${conv.drive_folder_id}" target="_blank" class="block text-center text-blue-600 text-sm mt-3 hover:underline">📁 Abrir en Drive</a>
          ` : ''}
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-5">
          <h2 class="font-semibold text-slate-700 mb-3">Timeline</h2>
          ${timeline || '<p class="text-sm text-slate-400">Sin eventos</p>'}
        </div>
      </div>
    </div>
  `;

  res.send(layout(nombre, body));
});

// ---------- Review de demos ----------

router.get('/review/:phone', requireAuth, (req, res) => {
  const phone = req.params.phone;
  const conv = db.getConversation(phone);
  if (!conv) return res.status(404).send('No encontrado');

  const slug = phoneSlug(phone);
  const nombre = conv.report?.cliente?.nombre || phone;
  const landingUrl = `/demos/${slug}/landing.html`;
  const mockupUrl = `/demos/${slug}/whatsapp.png`;
  const pdfUrl = `/demos/${slug}/propuesta.pdf`;

  const body = `
    <div class="mb-4">
      <a href="/admin/client/${encodeURIComponent(phone)}" class="text-sm text-blue-600 hover:underline">← Volver a la ficha</a>
    </div>
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Revisar demos — ${escapeHtml(nombre)}</h1>
        <div class="text-sm text-slate-500">${escapeHtml(phone)}</div>
      </div>
      <div class="flex gap-3">
        <form method="POST" action="/admin/reject/${encodeURIComponent(phone)}">
          <button class="bg-white border border-red-300 text-red-600 px-4 py-2 rounded hover:bg-red-50">Rechazar</button>
        </form>
        <form method="POST" action="/admin/approve/${encodeURIComponent(phone)}">
          <button class="bg-green-600 text-white px-6 py-2 rounded font-semibold hover:bg-green-700">✓ Aprobar y enviar al cliente</button>
        </form>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <h2 class="font-semibold mb-3">Landing HTML</h2>
        <iframe src="${landingUrl}" class="w-full h-[600px] border border-slate-200 rounded"></iframe>
        <a href="${landingUrl}" target="_blank" class="text-xs text-blue-600 mt-2 inline-block">Abrir en nueva pestaña →</a>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <h2 class="font-semibold mb-3">Mockup WhatsApp</h2>
        <img src="${mockupUrl}" class="w-full border border-slate-200 rounded" alt="WhatsApp mockup">
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <h2 class="font-semibold mb-3">Mini-propuesta PDF</h2>
        <object data="${pdfUrl}" type="application/pdf" class="w-full h-[600px] border border-slate-200 rounded">
          <p class="text-sm text-slate-500">No se puede mostrar el PDF. <a href="${pdfUrl}" class="text-blue-600">Descargarlo</a></p>
        </object>
      </div>
    </div>
  `;

  res.send(layout('Revisar demos', body));
});

// ---------- Acciones ----------

router.post('/stage/:phone', requireAuth, (req, res) => {
  const { stage } = req.body;
  db.updateClientStage(req.params.phone, stage);
  db.appendTimelineEvent(req.params.phone, { event: 'stage_changed', note: `Movido a "${stage}"` });
  res.redirect(`/admin/client/${encodeURIComponent(req.params.phone)}`);
});

router.post('/approve/:phone', requireAuth, async (req, res) => {
  const phone = req.params.phone;
  db.updateDemoStatus(phone, 'approved');
  db.appendTimelineEvent(phone, { event: 'demo_approved', note: 'David aprobó el demo' });
  // Enviar en background para no bloquear la respuesta
  orchestrator.sendApprovedDemoToClient(phone).catch(err =>
    console.error('Error enviando demo:', err));
  res.redirect(`/admin/client/${encodeURIComponent(phone)}`);
});

router.post('/reject/:phone', requireAuth, (req, res) => {
  const phone = req.params.phone;
  db.updateDemoStatus(phone, 'rejected');
  db.appendTimelineEvent(phone, { event: 'demo_rejected', note: 'David rechazó el demo' });
  res.redirect(`/admin/client/${encodeURIComponent(phone)}`);
});

router.post('/regenerate/:phone', requireAuth, (req, res) => {
  const phone = req.params.phone;
  orchestrator.regenerateDemos(phone).catch(err =>
    console.error('Error regenerando:', err));
  res.redirect(`/admin/client/${encodeURIComponent(phone)}`);
});

module.exports = router;
