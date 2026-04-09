const Anthropic = require('@anthropic-ai/sdk');
const PDFDocument = require('pdfkit');
const nodeHtmlToImage = require('node-html-to-image');

let anthropic;
function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

// ============ 1. Landing HTML generada por Claude ============
async function generateLandingHTML(report) {
  const { cliente, proyecto, requisitos, resumen_ejecutivo } = report;

  const prompt = `Armá una landing page HTML completa (autocontenida, con Tailwind por CDN) para presentar una propuesta comercial a este cliente:

Cliente: ${cliente.nombre || 'Cliente'}
Tipo de proyecto: ${proyecto.tipo || 'software a medida'}
Descripción: ${proyecto.descripcion || ''}
Plataforma: ${proyecto.plataforma || ''}
Funcionalidades: ${(proyecto.funcionalidades || []).join(', ')}
Presupuesto mencionado: ${requisitos.presupuesto || 'a definir'}
Plazo: ${requisitos.plazo || 'a definir'}
Resumen: ${resumen_ejecutivo || ''}

REQUISITOS:
- HTML5 completo, con <!DOCTYPE html>, <head>, <meta>, <body>
- Tailwind por CDN: <script src="https://cdn.tailwindcss.com"></script>
- Secciones: hero con nombre del cliente, qué entendí del proyecto, funcionalidades clave (grid de cards), timeline tentativo (3-4 pasos), precio estimado (si hay), CTA final "Agendá una llamada" con botón a https://wa.me/
- Tono: moderno, profesional, colores azul/violeta, mucho espacio en blanco
- Diseño responsive, mobile-first
- Personalizado: usá el NOMBRE del cliente varias veces, habla en "vos", español argentino
- El autor del trabajo es David Taranto (desarrollador freelance)
- No uses imágenes externas (usá emojis o iconos de Tailwind/heroicons inline SVG)

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

// ============ 2. Mockup de WhatsApp como PNG ============
async function generateWhatsappMockup(report) {
  const { cliente, proyecto } = report;

  // Pedirle a Claude una conversación de ejemplo corta
  const prompt = `Armá una conversación corta de WhatsApp (máximo 6 mensajes alternados) entre un cliente y el asistente automático de "${cliente.nombre || 'este negocio'}", relacionada con este proyecto:

Tipo: ${proyecto.tipo || 'negocio'}
Descripción: ${proyecto.descripcion || ''}

DEVOLVÉ UN JSON puro (sin markdown) con este formato:
{"messages": [{"from": "client", "text": "..."}, {"from": "bot", "text": "..."}]}

Tono argentino, con "vos", mensajes cortos y realistas. El bot debe sonar útil y amable.`;

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
    const safe = (m.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div style="display:flex;justify-content:${align};margin:6px 0;">
      <div style="max-width:75%;background:${bg};padding:8px 12px;border-radius:8px;box-shadow:0 1px 1px rgba(0,0,0,0.08);font-size:15px;line-height:1.35;">${safe}</div>
    </div>`;
  }).join('');

  const businessName = (cliente.nombre || 'Tu Negocio').replace(/</g, '&lt;');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { margin:0; padding:0; background:#e5ddd5; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; }
  .phone { width:720px; min-height:1280px; background:#e5ddd5; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><circle cx='10' cy='10' r='1' fill='%23d4ccc1'/></svg>"); padding:0; display:flex; flex-direction:column; }
  .header { background:#075e54; color:white; padding:20px 16px; display:flex; align-items:center; gap:12px; }
  .avatar { width:48px; height:48px; border-radius:50%; background:#25d366; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:bold; color:white; }
  .name { font-size:18px; font-weight:600; }
  .status { font-size:12px; opacity:0.85; }
  .chat { flex:1; padding:14px; }
  .footer { background:#f0f0f0; padding:12px 16px; display:flex; align-items:center; gap:10px; }
  .input { flex:1; background:white; border-radius:20px; padding:10px 16px; color:#888; font-size:14px; }
  .send { background:#075e54; color:white; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
</style></head>
<body>
  <div class="phone">
    <div class="header">
      <div class="avatar">${businessName.charAt(0).toUpperCase()}</div>
      <div>
        <div class="name">${businessName}</div>
        <div class="status">en línea</div>
      </div>
    </div>
    <div class="chat">${bubbles}</div>
    <div class="footer">
      <div class="input">Escribí un mensaje...</div>
      <div class="send">➤</div>
    </div>
  </div>
</body>
</html>`;

  const buffer = await nodeHtmlToImage({
    html,
    quality: 90,
    type: 'png',
    puppeteerArgs: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  return buffer;
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

// ============ Orquestador: genera los 3 en paralelo ============
async function generateAllDemos(report) {
  const [landingHTML, whatsappPng, pdfBuffer] = await Promise.all([
    generateLandingHTML(report).catch(err => {
      console.error('Error generando landing:', err);
      return `<!DOCTYPE html><html><body><h1>Propuesta para ${report.cliente?.nombre || 'Cliente'}</h1><p>Error generando landing.</p></body></html>`;
    }),
    generateWhatsappMockup(report).catch(err => {
      console.error('Error generando mockup WA:', err);
      return null;
    }),
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
