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
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const BLUE = '#2563eb';
    const DARK = '#1e293b';
    const LIGHT = '#f1f5f9';

    // ----- Portada -----
    doc.rect(0, 0, doc.page.width, 200).fill(BLUE);
    doc.fillColor('white').fontSize(12).font('Helvetica')
       .text('Propuesta de proyecto', 50, 60);
    doc.fontSize(28).font('Helvetica-Bold')
       .text(cliente.nombre || 'Cliente', 50, 90, { width: 500 });
    doc.fontSize(14).font('Helvetica')
       .text(proyecto.tipo || 'Software a medida', 50, 140, { width: 500 });

    doc.fillColor(DARK).fontSize(11).font('Helvetica')
       .text('Preparado por David Taranto — Desarrollador freelance', 50, 220);
    doc.text(new Date().toLocaleDateString('es-AR'), 50, 236);

    // ----- Qué entendí -----
    doc.moveDown(3);
    doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold')
       .text('Qué entendí de tu proyecto', 50, 290);
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(DARK).font('Helvetica')
       .text(proyecto.descripcion || resumen_ejecutivo || 'Proyecto a definir en próxima reunión.',
             { width: 500, align: 'justify' });

    // ----- Funcionalidades -----
    if (proyecto.funcionalidades && proyecto.funcionalidades.length) {
      doc.moveDown(1.5);
      doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold')
         .text('Funcionalidades clave');
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor(DARK).font('Helvetica');
      proyecto.funcionalidades.forEach(f => {
        doc.text(`•  ${f}`, { width: 500 });
        doc.moveDown(0.2);
      });
    }

    // ----- Detalles técnicos -----
    doc.moveDown(1.5);
    doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold').text('Detalles');
    doc.moveDown(0.5);

    const row = (label, value) => {
      if (!value) return;
      const y = doc.y;
      doc.fontSize(10).fillColor('#64748b').font('Helvetica-Bold').text(label, 50, y, { width: 130 });
      doc.fillColor(DARK).font('Helvetica').text(value, 180, y, { width: 370 });
      doc.moveDown(0.4);
    };
    row('Plataforma', proyecto.plataforma);
    row('Estado actual', proyecto.estado_actual);
    row('Stack sugerido', requisitos.stack_sugerido);
    row('Plazo', requisitos.plazo);
    row('Presupuesto', requisitos.presupuesto);
    row('Urgencia', requisitos.urgencia);

    // ----- Página 2: timeline + próximos pasos -----
    doc.addPage();
    doc.fontSize(20).fillColor(BLUE).font('Helvetica-Bold').text('Cómo vamos a trabajar', 50, 60);
    doc.moveDown(1);

    const steps = [
      { n: '1', title: 'Llamada inicial (30 min)', text: 'Terminamos de alinear requisitos, alcance y tiempos.' },
      { n: '2', title: 'Propuesta formal', text: 'Te paso presupuesto definitivo, cronograma y forma de pago.' },
      { n: '3', title: 'Desarrollo', text: 'Avances semanales con demos para que vayas viendo el progreso.' },
      { n: '4', title: 'Entrega y soporte', text: 'Puesta en producción, capacitación y soporte durante los primeros 30 días.' },
    ];
    steps.forEach(s => {
      const y = doc.y;
      doc.circle(65, y + 10, 14).fill(BLUE);
      doc.fillColor('white').fontSize(13).font('Helvetica-Bold').text(s.n, 60, y + 4);
      doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold').text(s.title, 95, y, { width: 450 });
      doc.fontSize(10).font('Helvetica').fillColor('#475569').text(s.text, 95, y + 18, { width: 450 });
      doc.moveDown(2);
    });

    // ----- Próximo paso -----
    doc.moveDown(1);
    doc.rect(50, doc.y, 500, 90).fill(LIGHT);
    const boxY = doc.y + 15;
    doc.fillColor(BLUE).fontSize(14).font('Helvetica-Bold')
       .text('Próximo paso', 65, boxY);
    doc.fillColor(DARK).fontSize(11).font('Helvetica')
       .text('Respondé este WhatsApp o mandame un mensaje para coordinar la llamada inicial. Te contesto ese mismo día.',
             65, boxY + 22, { width: 470 });

    // Footer
    doc.fontSize(9).fillColor('#94a3b8').font('Helvetica')
       .text('David Taranto · Desarrollo freelance · Salta, Argentina',
             50, 780, { width: 500, align: 'center' });

    doc.end();
  });
}

// Detecta si el proyecto incluye bot/automatización de WhatsApp
function isWhatsappBotProject(report) {
  const fields = [
    report.proyecto?.tipo || '',
    report.proyecto?.descripcion || '',
    (report.proyecto?.funcionalidades || []).join(' '),
    report.proyecto?.plataforma || '',
  ].join(' ').toLowerCase();
  return ['whatsapp', 'bot', 'chatbot', 'automatizac', 'asistente automático', 'mensaje automático']
    .some(k => fields.includes(k));
}

// ============ Orquestador: genera demos según el tipo de proyecto ============
async function generateAllDemos(report) {
  const needsWAMockup = isWhatsappBotProject(report);
  console.log(`[demos] Tipo: ${report.proyecto?.tipo} | WA mockup: ${needsWAMockup}`);

  const [landingHTML, whatsappPng, pdfBuffer] = await Promise.all([
    generateLandingHTML(report).catch(err => {
      console.error('Error generando landing:', err);
      return `<!DOCTYPE html><html><body><h1>Propuesta para ${report.cliente?.nombre || 'Cliente'}</h1><p>Error generando landing.</p></body></html>`;
    }),
    needsWAMockup
      ? generateWhatsappMockup(report).catch(err => { console.error('Error generando mockup WA:', err); return null; })
      : Promise.resolve(null),
    generateMiniPDF(report).catch(err => {
      console.error('Error generando PDF:', err);
      return null;
    }),
  ]);

  return { landingHTML, whatsappPng, pdfBuffer };
}

module.exports = {
  generateLandingHTML,
  generateWhatsappMockup,
  generateMiniPDF,
  generateAllDemos,
};
