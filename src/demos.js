const Anthropic = require('@anthropic-ai/sdk');
const PDFDocument = require('pdfkit');

let anthropic;
function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

// ============ 1. Demo visual del producto (primera pantalla real) ============
async function generateLandingHTML(report) {
  const { cliente, proyecto, requisitos } = report;

  const prompt = `Sos un diseñador UI/UX experto. Tenés que crear una demo visual HTML de la PRIMERA PANTALLA del producto que un cliente le encargó a un desarrollador freelance.

NO hagas una "propuesta comercial" ni un resumen de lo que se habló. El cliente ya sabe lo que pidió.
Hacé una demo visual que parezca el producto REAL funcionando: la primera pantalla de la app/web/sistema que el cliente imaginó.

DATOS DEL PROYECTO:
- Nombre del negocio/cliente: ${cliente.nombre || 'Mi Negocio'}
- Tipo de producto: ${proyecto.tipo || 'web'}
- Descripción: ${proyecto.descripcion || ''}
- Plataforma: ${proyecto.plataforma || 'web'}
- Funcionalidades pedidas: ${(proyecto.funcionalidades || []).join(', ')}
- Colores o estilo mencionado: ${requisitos.stack_sugerido || ''} ${proyecto.estado_actual || ''}

EJEMPLOS de lo que tenés que hacer según el tipo:
- Si pide "web para restaurante" → primera pantalla del sitio: hero con foto (emoji), menú destacado, botón de reserva/pedido
- Si pide "sistema de turnos" → pantalla de reserva de turno: calendario visual, horarios disponibles, formulario simple
- Si pide "tienda online / e-commerce" → página de producto: imagen (emoji grande), precio, botón agregar al carrito
- Si pide "landing page para gimnasio" → hero con logo (inicial), horarios, planes de membresía, CTA
- Si pide "bot de WhatsApp / automatización" → web de presentación del bot: qué automatiza, capturas de conversación de ejemplo, CTA
- Si pide "app móvil" → simulá la primera pantalla de la app en formato celular (contenedor 390px, borde redondeado, status bar): home screen con navegación inferior, contenido principal
- Si pide "sistema de gestión / backoffice" → dashboard: métricas en cards, tabla de datos reciente, sidebar de navegación
- Si pide "app de delivery / pedidos" → pantalla de inicio: búsqueda, categorías con iconos, productos destacados con precio

REGLAS TÉCNICAS:
- HTML5 completo, autocontenido, con <!DOCTYPE html>
- Tailwind por CDN: <script src="https://cdn.tailwindcss.com"></script>
- NO uses imágenes externas. Usá emojis grandes como imágenes placeholder, SVGs inline simples, o gradientes de color
- Responsive, mobile-first
- Usá los colores del negocio si los mencionaron; si no, elegí una paleta coherente con el rubro
- Que se vea como un producto real, no como una plantilla genérica
- Podés usar JavaScript inline para interactividad visual básica (tabs, hover states) — sin fetch ni APIs
- Pie de página discreto: "Demo generada por David Taranto · Desarrollador freelance"
- Idioma: español argentino

DEVOLVÉ ÚNICAMENTE EL HTML, sin markdown, sin backticks, sin explicaciones.`;

  const response = await getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  let html = response.content[0].text.trim();
  // Remover fences si Claude los mete igual
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/, '').trim();
  return html;
}

// ============ 2. Mockup de WhatsApp como HTML ============
// (Sin puppeteer — se sirve directo como página web, sin conversión a PNG)
async function generateWhatsappMockup(report) {
  const { cliente, proyecto } = report;

  const prompt = `Armá una conversación realista de WhatsApp (5-7 mensajes) entre un cliente REAL y el bot de WhatsApp de "${cliente.nombre || 'este negocio'}".

Esta es una DEMO del bot que se va a construir. Mostrá cómo quedaría funcionando una vez listo.

Proyecto: ${proyecto.tipo || 'negocio'}
Descripción: ${proyecto.descripcion || ''}
Funcionalidades del bot: ${(proyecto.funcionalidades || []).join(', ')}

REGLAS:
- El cliente hace una consulta REAL relacionada con el negocio (no "hola" genérico)
- El bot responde de forma útil, eficiente y con el tono del negocio
- Mostrá al menos 1 funcionalidad concreta del bot (ej: dar precio, agendar turno, mostrar menú, confirmar pedido)
- Mensajes cortos, naturales, argentinos ("vos", "dale", "te paso", "genial")
- El bot NO es un asistente genérico: es específico para este negocio

DEVOLVÉ UN JSON puro (sin markdown) con este formato exacto:
{"messages": [{"from": "client", "text": "..."}, {"from": "bot", "text": "..."}]}`;

  const response = await getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  let jsonText = response.content[0].text.trim()
    .replace(/^```json?\n?/i, '').replace(/\n?```$/, '').trim();
  let conv;
  try {
    conv = JSON.parse(jsonText);
  } catch (e) {
    conv = {
      messages: [
        { from: 'client', text: 'Hola!' },
        { from: 'bot', text: `¡Hola! Soy el asistente de ${cliente.nombre || 'tu negocio'}. ¿En qué te puedo ayudar?` },
      ],
    };
  }

  const bubbles = (conv.messages || []).map(m => {
    const isBot = m.from === 'bot';
    const bg = isBot ? '#ffffff' : '#dcf8c6';
    const align = isBot ? 'flex-start' : 'flex-end';
    const safe = (m.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const time = `${12 + Math.floor(Math.random() * 3)}:${String(Math.floor(Math.random() * 59)).padStart(2,'0')}`;
    return `<div style="display:flex;justify-content:${align};margin:4px 0;">
      <div style="max-width:78%;background:${bg};padding:8px 12px 6px;border-radius:${isBot ? '0 8px 8px 8px' : '8px 0 8px 8px'};box-shadow:0 1px 2px rgba(0,0,0,0.12);font-size:15px;line-height:1.4;">
        ${safe}
        <div style="font-size:11px;color:#999;text-align:right;margin-top:2px;">${time} ${isBot ? '' : '✓✓'}</div>
      </div>
    </div>`;
  }).join('');

  const businessName = (cliente.nombre || 'Tu Negocio').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const initial = businessName.charAt(0).toUpperCase();

  // Devuelve HTML como Buffer (se guarda como whatsapp.html)
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Demo WhatsApp — ${businessName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #111b21; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; padding: 20px; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; }
    .phone { width: 100%; max-width: 420px; background: #e5ddd5; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
    .header { background: #075e54; color: white; padding: 14px 16px; display: flex; align-items: center; gap: 12px; }
    .avatar { width: 44px; height: 44px; border-radius: 50%; background: #25d366; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; flex-shrink: 0; }
    .hinfo .name { font-size: 17px; font-weight: 600; }
    .hinfo .status { font-size: 12px; opacity: 0.8; }
    .chat { padding: 12px 10px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='5' cy='5' r='1' fill='%23c9bfb5' opacity='0.3'/%3E%3C/svg%3E"); min-height: 300px; }
    .date-chip { text-align: center; margin: 8px 0; }
    .date-chip span { background: rgba(255,255,255,0.7); font-size: 12px; padding: 3px 10px; border-radius: 8px; color: #555; }
    .footer { background: #f0f0f0; padding: 10px 12px; display: flex; align-items: center; gap: 8px; }
    .footer-input { flex: 1; background: white; border-radius: 24px; padding: 10px 16px; font-size: 15px; color: #aaa; }
    .footer-btn { width: 46px; height: 46px; border-radius: 50%; background: #075e54; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; flex-shrink: 0; }
    .label { text-align: center; padding: 10px; font-size: 12px; color: #666; background: #f5f5f5; }
  </style>
</head>
<body>
  <div class="phone">
    <div class="header">
      <div class="avatar">${initial}</div>
      <div class="hinfo">
        <div class="name">${businessName}</div>
        <div class="status">en línea</div>
      </div>
    </div>
    <div class="chat">
      <div class="date-chip"><span>Hoy</span></div>
      ${bubbles}
    </div>
    <div class="footer">
      <div class="footer-input">Escribí un mensaje...</div>
      <div class="footer-btn">➤</div>
    </div>
    <div class="label">Vista previa del asistente de WhatsApp • Desarrollado por David Taranto</div>
  </div>
</body>
</html>`;

  return Buffer.from(html, 'utf-8');
}

// ============ 3. Mini-propuesta PDF con pdfkit ============
async function generateMiniPDF(report) {
  return new Promise((resolve, reject) => {
    const { cliente, proyecto, requisitos, resumen_ejecutivo } = report;
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595.28;
    const MARGIN = 50;
    const CW = W - MARGIN * 2;
    const BLUE = '#2563eb';
    const DARK_BLUE = '#1d4ed8';
    const DARK = '#1e293b';
    const GRAY = '#64748b';
    const LIGHT = '#f8fafc';
    const LIGHT_BLUE = '#eff6ff';

    // ─── PÁGINA 1 ─────────────────────────────────────────────────────────────

    // Header azul
    doc.rect(0, 0, W, 180).fill(BLUE);
    // Decoración: círculo grande translúcido
    doc.circle(W - 60, 30, 110).fillOpacity(0.08).fill('white');
    doc.fillOpacity(1);

    doc.fillColor('white').fontSize(10).font('Helvetica').opacity(0.7)
       .text('PROPUESTA DE PROYECTO', MARGIN, 45, { letterSpacing: 2 });
    doc.opacity(1);
    doc.fontSize(26).font('Helvetica-Bold').fillColor('white')
       .text(cliente.nombre || 'Cliente', MARGIN, 65, { width: CW - 80 });
    doc.fontSize(13).font('Helvetica').fillColor('white').opacity(0.85)
       .text(proyecto.tipo || 'Desarrollo a medida', MARGIN, 105, { width: CW });
    doc.opacity(1);

    // Fecha y autor en header
    const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.fontSize(9).fillColor('white').opacity(0.6)
       .text(`Preparado por David Taranto  ·  ${fecha}`, MARGIN, 150, { width: CW });
    doc.opacity(1);

    // ─── Resumen ejecutivo ─────────────────────────────────────────────────────
    const summaryText = resumen_ejecutivo || proyecto.descripcion || 'Proyecto a medida según los requerimientos acordados.';
    const summaryLines = Math.ceil(summaryText.length / 90);
    const summaryH = Math.max(70, summaryLines * 16 + 30);

    doc.rect(MARGIN, 200, CW, summaryH).fill(LIGHT_BLUE);
    doc.fillColor(DARK_BLUE).fontSize(9).font('Helvetica-Bold')
       .text('LO QUE ENTENDÍ DE TU PROYECTO', MARGIN + 16, 215, { letterSpacing: 1 });
    doc.fillColor(DARK).fontSize(11).font('Helvetica')
       .text(summaryText, MARGIN + 16, 232, { width: CW - 32, align: 'justify' });

    // ─── Funcionalidades ──────────────────────────────────────────────────────
    let y = 200 + summaryH + 20;
    doc.fillColor(BLUE).fontSize(13).font('Helvetica-Bold')
       .text('Funcionalidades incluidas', MARGIN, y);
    y += 22;

    const funcs = proyecto.funcionalidades || [];
    if (funcs.length > 0) {
      funcs.forEach(f => {
        // Checkbox-like dot
        doc.circle(MARGIN + 6, y + 5, 4).fill(BLUE);
        doc.fillColor(DARK).fontSize(10.5).font('Helvetica')
           .text(f, MARGIN + 18, y, { width: CW - 18 });
        y += 18;
      });
    } else {
      doc.fillColor(GRAY).fontSize(10).text('A definir en la llamada inicial.', MARGIN + 18, y);
      y += 18;
    }

    // ─── Detalles del proyecto ─────────────────────────────────────────────────
    y += 12;
    doc.fillColor(BLUE).fontSize(13).font('Helvetica-Bold')
       .text('Detalles del proyecto', MARGIN, y);
    y += 20;

    const details = [
      ['Plataforma',     proyecto.plataforma],
      ['Estado actual',  proyecto.estado_actual],
      ['Plazo estimado', requisitos?.plazo],
      ['Presupuesto',    requisitos?.presupuesto],
      ['Urgencia',       requisitos?.urgencia],
      ['Stack sugerido', requisitos?.stack_sugerido],
    ].filter(([, v]) => v);

    // Two-column layout for details
    const colW = CW / 2 - 8;
    details.forEach(([label, value], idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const dx = MARGIN + col * (colW + 16);
      const dy = y + row * 32;
      doc.rect(dx, dy, colW, 28).fill(LIGHT);
      doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold')
         .text(label.toUpperCase(), dx + 8, dy + 6, { width: colW - 16 });
      doc.fillColor(DARK).fontSize(10).font('Helvetica')
         .text(String(value), dx + 8, dy + 16, { width: colW - 16 });
    });

    // ─── PÁGINA 2 ─────────────────────────────────────────────────────────────
    doc.addPage();

    // Thin accent bar
    doc.rect(0, 0, W, 6).fill(BLUE);

    doc.fillColor(DARK).fontSize(20).font('Helvetica-Bold')
       .text('Cómo vamos a trabajar', MARGIN, 30);
    doc.fillColor(GRAY).fontSize(11).font('Helvetica')
       .text('Mi proceso de trabajo es simple, con avances continuos para que siempre sepas cómo avanza tu proyecto.', MARGIN, 58, { width: CW });

    let sy = 100;
    const steps = [
      { n: '1', title: 'Llamada inicial (30 min)', text: 'Alineamos requisitos, alcance, tiempos y cualquier duda que quede. Sin costo, sin compromiso.' },
      { n: '2', title: 'Propuesta formal',          text: 'Te presento el presupuesto definitivo, el cronograma detallado y las opciones de pago.' },
      { n: '3', title: 'Desarrollo con avances',    text: 'Trabajamos en sprints de 1 semana. Te mando demos funcionales para que vayas viendo el avance en tiempo real.' },
      { n: '4', title: 'Entrega + soporte 30 días', text: 'Puesta en producción, capacitación de uso y soporte técnico incluido durante el primer mes.' },
    ];

    steps.forEach(s => {
      // Number circle
      doc.circle(MARGIN + 14, sy + 12, 14).fill(BLUE);
      doc.fillColor('white').fontSize(12).font('Helvetica-Bold')
         .text(s.n, MARGIN + 9, sy + 7);
      // Connector line (except last)
      if (s.n !== '4') {
        doc.moveTo(MARGIN + 14, sy + 26).lineTo(MARGIN + 14, sy + 60).stroke('#cbd5e1');
      }
      doc.fillColor(DARK).fontSize(12).font('Helvetica-Bold')
         .text(s.title, MARGIN + 36, sy, { width: CW - 36 });
      doc.fillColor(GRAY).fontSize(10).font('Helvetica')
         .text(s.text, MARGIN + 36, sy + 16, { width: CW - 36 });
      sy += 65;
    });

    // ─── CTA box ──────────────────────────────────────────────────────────────
    sy += 10;
    doc.rect(MARGIN, sy, CW, 100).fill(BLUE);
    doc.fillColor('white').fontSize(16).font('Helvetica-Bold')
       .text('¿Empezamos?', MARGIN + 20, sy + 18);
    doc.fillColor('white').fontSize(11).font('Helvetica').opacity(0.9)
       .text('Respondé este mensaje o mandame un WhatsApp y coordinamos una llamada de 30 minutos esta semana. Contesto el mismo día.', MARGIN + 20, sy + 42, { width: CW - 40 });
    doc.opacity(1);

    // Contact row
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold').opacity(0.7)
       .text('📱 WhatsApp  ·  📧 david.taranto@gmail.com  ·  💼 David Taranto — Desarrollador Freelance', MARGIN + 20, sy + 82, { width: CW - 40 });
    doc.opacity(1);

    // Footer on page 2
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
       .text('David Taranto · Desarrollo de software a medida · Salta, Argentina', MARGIN, 800, { width: CW, align: 'center' });

    doc.end();
  });
}

function detectDemoTypes(report) {
  const tipo         = (report.proyecto?.tipo || '').toLowerCase();
  const descripcion  = (report.proyecto?.descripcion || '').toLowerCase();
  const plataforma   = (report.proyecto?.plataforma || '').toLowerCase();
  const funcionales  = (report.proyecto?.funcionalidades || []).join(' ').toLowerCase();
  const allText      = [tipo, descripcion, plataforma, funcionales].join(' ');

  // ── WA bot: debe ser explícitamente un bot/automatización, NO "botón de WhatsApp"
  // Usamos lookahead/lookbehind para que "bot" no coincida con "botón" (ó es fuera de \w en JS)
  // pero sí con "bot de whatsapp", "chatbot", "bot de mensajes", etc.
  const waBotPattern = /chatbot|bot\s+de\s+whatsapp|bot\s+de\s+mensajes|asistente\s+autom[aá]tico|automatizaci[oó]n\s+de\s+(whatsapp|mensajes)|respuestas\s+autom[aá]ticas|asistente\s+de\s+whatsapp|(?<![a-záéíóúüñ])bot(?![a-záéíóúüñ])/i;

  const webKeywords = ['web', 'página', 'pagina', 'sitio', 'landing', 'tienda', 'shop', 'ecommerce',
    'e-commerce', 'app', 'aplicación', 'aplicacion', 'sistema', 'dashboard', 'panel', 'gestión',
    'gestion', 'plataforma'];

  const needsWA  = waBotPattern.test(allText);
  const needsWeb = webKeywords.some(k => allText.includes(k));

  return {
    landing: needsWeb || !needsWA,  // si no es WA puro, siempre hacemos visual web/app
    whatsapp: needsWA,
  };
}

// ============ Orquestador: genera demos según el tipo de proyecto ============
async function generateAllDemos(report) {
  const demos = detectDemoTypes(report);
  console.log(`[demos] Tipo: "${report.proyecto?.tipo}" → landing:${demos.landing} WA:${demos.whatsapp}`);

  const [landingHTML, whatsappPng, pdfBuffer] = await Promise.all([
    demos.landing
      ? generateLandingHTML(report).catch(err => { console.error('Error generando landing:', err); return null; })
      : Promise.resolve(null),
    demos.whatsapp
      ? generateWhatsappMockup(report).catch(err => { console.error('Error generando mockup WA:', err); return null; })
      : Promise.resolve(null),
    generateMiniPDF(report).catch(err => { console.error('Error generando PDF:', err); return null; }),
  ]);

  return { landingHTML, whatsappPng, pdfBuffer };
}

module.exports = {
  generateLandingHTML,
  generateWhatsappMockup,
  generateMiniPDF,
  generateAllDemos,
};
