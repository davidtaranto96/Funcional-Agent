const Anthropic = require('@anthropic-ai/sdk');
const PDFDocument = require('pdfkit');

let anthropic;
function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

// ============ Timeout helper ============
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms)),
  ]);
}

// ============ 1. Demo visual del producto (primera pantalla real) ============
async function generateLandingHTML(report) {
  const { cliente, proyecto, requisitos } = report;

  const prompt = `Sos un diseñador UI/UX experto de nivel senior. Tenés que crear una demo visual HTML de la PRIMERA PANTALLA del producto que un cliente le encargó a un desarrollador freelance.

NO hagas una "propuesta comercial" ni un resumen de lo que se habló. El cliente ya sabe lo que pidió.
Hacé una demo visual que parezca el producto REAL funcionando: la primera pantalla de la app/web/sistema que el cliente imaginó.

DATOS COMPLETOS DEL PROYECTO:
- Cliente: ${cliente.nombre || 'Mi Negocio'}
- Rubro: ${cliente.rubro || 'no especificado'}
- Tipo de producto: ${proyecto.tipo || 'web'}
- Descripción completa: ${proyecto.descripcion || ''}
- Plataforma: ${proyecto.plataforma || 'web'}
- Funcionalidades pedidas: ${(proyecto.funcionalidades || []).map((f, i) => (i + 1) + '. ' + f).join('\n  ')}
- Audiencia objetivo: ${proyecto.audiencia_objetivo || 'general'}
- Modelo de negocio: ${proyecto.modelo_negocio || ''}
- Integraciones: ${(proyecto.integraciones_necesarias || []).join(', ') || 'no especificadas'}
- Nivel técnico del cliente: ${cliente.nivel_tecnico || 'medio'}
- Estado actual: ${proyecto.estado_actual || 'desde cero'}

EJEMPLOS DETALLADOS según el tipo de proyecto (usá como referencia para la estructura visual):

1. Web para RESTAURANTE/COMIDA → Menú interactivo con categorías (Entradas, Principales, Postres, Bebidas), cards de platos con emoji de imagen + precio + botón "Agregar", carrito flotante con cantidad, hero con el nombre del local y estilo gastronómico, sección de delivery/retiro

2. SISTEMA DE TURNOS / Consultorio → Calendario visual con días clickeables, grilla de horarios disponibles (verde) y ocupados (gris), formulario lateral con nombre + teléfono + motivo, confirmación de turno con ícono de check

3. TIENDA ONLINE / E-commerce → Grid de productos con foto (emoji grande), precio, descuento tachado, botón agregar al carrito, filtros laterales (categoría, precio, talle), header con buscador + carrito + usuario, badges de "Nuevo" o "Oferta"

4. LANDING PAGE → Hero impactante con gradiente, título grande + subtítulo + CTA, sección de beneficios con íconos, testimonios con avatar + estrellas, pricing cards si aplica, footer con contacto

5. BOT DE WHATSAPP / Automatización → Web de presentación: mockup de celular mostrando conversación de ejemplo, lista de funcionalidades que automatiza, sección "Cómo funciona" en 3 pasos, CTA para probar demo

6. APP MÓVIL → Envolvé todo en un frame de celular (contenedor 390x844px, border-radius:40px, borde gris, status bar con hora+batería+señal), pantalla home con bottom navigation (4-5 tabs con íconos), contenido principal scrolleable

7. SISTEMA DE GESTIÓN / Backoffice / Dashboard → Sidebar oscuro con logo + menú de navegación (Dashboard, Clientes, Ventas, Reportes, Configuración), área principal con métricas en cards coloridas (ingresos, clientes nuevos, pedidos, tasa conversión), tabla de datos reciente con 5-6 filas reales, gráfico simple con CSS

8. APP DE DELIVERY / Pedidos → Buscador prominente, categorías horizontales con íconos (Pizza, Sushi, Hamburguesas, Helados), cards de restaurantes/productos con rating + tiempo de entrega + precio mínimo, bottom nav

9. SALUD / App médica → Dashboard de paciente con barra de búsqueda de condiciones/medicamentos, cards de resultados médicos, sidebar con categorías (Mis Turnos, Recetas, Estudios, Historial), UI profesional médica con paleta azul/verde

10. EDUCACIÓN / E-learning → Catálogo de cursos en grid, barra de progreso en cada curso, área de video player, sección "Mis cursos" con % completado, sidebar con módulos y lecciones

11. FITNESS / Gimnasio → Grilla de clases semanales (Lunes a Sábado, horarios), cards de planes de membresía (Básico, Premium, VIP) con precios y features, perfiles de entrenadores con foto (emoji) y especialidad, botón de reserva de clase

12. INMOBILIARIA / Real estate → Búsqueda con filtros (ubicación, precio min/max, ambientes, tipo), cards de propiedades con foto (emoji), precio, m², ubicación, badges (Nuevo, Oportunidad), área de mapa placeholder, listado de resultados

13. LEGAL / Contable → Portal de cliente: sidebar con Mis Casos, Documentos, Pagos, Mensajes; tabla de documentos con estado (Pendiente, Firmado, Vencido); timeline de caso con pasos; look profesional y sobrio

14. AGRO / Campo → Dashboard IoT: widgets de sensores (Humedad, Temperatura, pH del suelo), mapa de lotes/parcelas, alertas de riego, gráfico de cosecha, paleta verde/tierra

15. VETERINARIA → Perfil de mascota (nombre, raza, edad, foto emoji), botón de agendar turno, historial médico con vacunas y consultas, tarjeta del veterinario asignado

16. SaaS / B2B → Página de pricing con 3 columnas (Starter, Pro, Enterprise), tabla comparativa de features con checks, preview del dashboard del producto, testimonios de empresas

17. SOCIAL / Comunidad → Feed con posts (avatar + nombre + texto + likes/comments), sidebar con trending topics, área de mensajes, perfil con stats (seguidores, posts, likes)

18. FINTECH / Pagos → Balance de cuenta prominente, historial de transacciones (ícono + descripción + monto + fecha), formulario de transferencia, tarjeta virtual preview, gráfico de gastos por categoría

19. LOGÍSTICA / Envíos → Tracking de pedido con timeline (Recibido → En preparación → En camino → Entregado), mapa de ruta placeholder, lista de envíos con estado y filtros, dashboard de flota

20. RRHH / Reclutamiento → Job board con cards de posiciones abiertas, pipeline de candidatos (columnas kanban: Aplicó, Entrevista, Técnica, Oferta), calendario de entrevistas

21. INVENTARIO / Stock → Tabla de productos con columnas (SKU, Nombre, Stock, Precio, Proveedor), alertas de stock bajo en rojo, filtros por categoría, badges de estado (OK, Bajo, Agotado)

22. RESERVAS / Booking → Vista calendario mensual/semanal, selector de servicio + profesional, slots de horarios disponibles, resumen de reserva con confirmación, colores por tipo de servicio

REGLAS TÉCNICAS OBLIGATORIAS:
- HTML5 completo, autocontenido, con <!DOCTYPE html>
- Tailwind por CDN: <script src="https://cdn.tailwindcss.com"></script>
- NO uses imágenes externas. Usá emojis grandes como imágenes placeholder, SVGs inline simples, o gradientes de color
- Responsive, mobile-first
- Generá AL MENOS 3 secciones distintas (hero/header, contenido principal, contenido secundario)
- Para dashboards: incluí sidebar de navegación con items de menú REALES y ESPECÍFICOS del dominio
- Para apps móviles: envolvé todo en un frame de celular realista (contenedor 390x844, border-radius:40px, borde gris #e5e7eb 3px, status bar arriba con hora + señal + batería)
- Mostrá DATOS DE EJEMPLO REALISTAS relevantes para la industria — NUNCA "Lorem ipsum". Usá nombres, precios, fechas, métricas que parezcan reales para el rubro
- Usá TERMINOLOGÍA E ÍCONOS ESPECÍFICOS del dominio
- Incluí micro-interacciones CSS: hover effects (transform, shadow, opacity), transitions (transition: all 0.2s), focus states en inputs
- Mostrá al menos 5-6 items de datos (filas de tabla, cards, items de lista) para que se sienta como una app real con contenido
- Paleta de colores según la industria:
  * Médico/Salud: azul #2563eb + verde #059669
  * Finanzas/Fintech: azul oscuro #1e3a8a + dorado #d97706
  * Eco/Agro: verde #15803d + tierra #92400e
  * Comida/Restaurante: cálidos naranja #ea580c + rojo #dc2626
  * Legal/Contable: gris oscuro #374151 + azul sobrio #3b82f6
  * Fitness: negro #111 + lima #84cc16 o naranja energético
  * Educación: púrpura #7c3aed + azul #3b82f6
  * Inmobiliaria: azul real #1d4ed8 + blanco limpio
  * Si el cliente mencionó colores, priorizar esos
- Que se vea como un producto real, no como una plantilla genérica
- Usá JavaScript inline para interactividad visual básica (tabs activos, hover states, toggles) — sin fetch ni APIs
- Pie de página discreto: "Demo generada por David Taranto · Desarrollador freelance"
- Idioma: español argentino

DEVOLVÉ ÚNICAMENTE EL HTML, sin markdown, sin backticks, sin explicaciones.`;

  const apiCall = getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const response = await withTimeout(apiCall, 60000, 'generateLandingHTML');

  let html = response.content[0].text.trim();
  // Remover fences si Claude los mete igual
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/, '').trim();
  return html;
}

// ============ 2. Mockup de WhatsApp como HTML ============
// (Sin puppeteer — se sirve directo como página web, sin conversión a PNG)
async function generateWhatsappMockup(report) {
  const { cliente, proyecto } = report;

  const prompt = `Armá una conversación realista de WhatsApp (8-12 mensajes) entre un cliente REAL y el bot de WhatsApp de "${cliente.nombre || 'este negocio'}".

Esta es una DEMO del bot que se va a construir. Mostrá cómo quedaría funcionando una vez listo.

Proyecto: ${proyecto.tipo || 'negocio'}
Rubro: ${cliente.rubro || 'no especificado'}
Descripción: ${proyecto.descripcion || ''}
Funcionalidades del bot: ${(proyecto.funcionalidades || []).join(', ')}

REGLAS:
- El cliente hace consultas REALES relacionadas con el negocio (no "hola" genérico)
- El bot responde de forma útil, eficiente y con el tono del negocio
- Mostrá al menos 2 funcionalidades DISTINTAS del bot en la conversación (ej: primero consulta de precio, luego agenda un turno; o primero pide el menú, luego hace un pedido)
- Mensajes cortos, naturales, argentinos ("vos", "dale", "te paso", "genial", "listo", "barbaro")
- El bot NO es un asistente genérico: es específico para este negocio
- Incluí formato en los mensajes del bot:
  * Usá *texto* para negritas en info importante (precios, nombres, fechas)
  * Usá saltos de línea \\n para estructurar respuestas largas (listas, opciones)
  * Simulá botones de respuesta rápida con corchetes: [Opción 1] [Opción 2] [Opción 3]
- La personalidad del bot debe coincidir con el tipo de negocio:
  * Médico/Legal: profesional, formal pero cálido
  * Restaurante/Tienda: amigable, entusiasta
  * Fitness/Deporte: motivacional, energético
  * Tecnología/SaaS: claro, directo, técnico pero accesible
- El cliente debe reaccionar positivamente al menos una vez ("genial", "perfecto", "dale va")
- El flujo debe sentirse natural: consulta → respuesta → seguimiento → cierre

DEVOLVÉ UN JSON puro (sin markdown, sin backticks) con este formato exacto:
{"messages": [{"from": "client", "text": "..."}, {"from": "bot", "text": "..."}]}`;

  const apiCall = getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const response = await withTimeout(apiCall, 30000, 'generateWhatsappMockup');

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
    let safe = (m.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Format bold *text* -> <b>text</b>
    safe = safe.replace(/\*([^*]+)\*/g, '<b>$1</b>');
    // Format newlines
    safe = safe.replace(/\\n/g, '<br>');
    // Format quick reply buttons [Option]
    safe = safe.replace(/\[([^\]]+)\]/g, '<span style="display:inline-block;background:#e3f2fd;color:#1976d2;padding:4px 12px;border-radius:16px;font-size:13px;margin:3px 2px;border:1px solid #bbdefb;cursor:pointer;">$1</span>');
    const time = `${12 + Math.floor(Math.random() * 3)}:${String(Math.floor(Math.random() * 59)).padStart(2, '0')}`;
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
    const analisis = report.analisis || null;
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
    const GREEN = '#059669';
    const LIGHT_GREEN = '#ecfdf5';
    const AMBER = '#d97706';
    const LIGHT_AMBER = '#fffbeb';

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

    // ─── Análisis de complejidad (si existe) ──────────────────────────────────
    let y = 200 + summaryH + 16;

    if (analisis) {
      const complejidad = analisis.complejidad_estimada || null;
      const horas = analisis.horas_estimadas || null;
      const recomendaciones = analisis.recomendaciones_tecnicas || analisis.recomendaciones || [];
      const mvp = analisis.mvp_sugerido || null;

      if (complejidad || horas) {
        // Complejidad + horas box — two columns side by side
        const boxH = 50;
        const halfW = (CW - 12) / 2;

        if (complejidad) {
          const compColor = complejidad.toLowerCase().includes('alta') ? '#dc2626'
            : complejidad.toLowerCase().includes('media') ? AMBER : GREEN;
          const compBg = complejidad.toLowerCase().includes('alta') ? '#fef2f2'
            : complejidad.toLowerCase().includes('media') ? LIGHT_AMBER : LIGHT_GREEN;

          doc.rect(MARGIN, y, halfW, boxH).fill(compBg);
          doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold')
             .text('COMPLEJIDAD ESTIMADA', MARGIN + 12, y + 10, { letterSpacing: 1 });
          doc.fillColor(compColor).fontSize(16).font('Helvetica-Bold')
             .text(complejidad, MARGIN + 12, y + 26, { width: halfW - 24 });
        }

        if (horas) {
          const hX = MARGIN + halfW + 12;
          doc.rect(hX, y, halfW, boxH).fill(LIGHT_GREEN);
          doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold')
             .text('HORAS ESTIMADAS', hX + 12, y + 10, { letterSpacing: 1 });
          doc.fillColor(GREEN).fontSize(16).font('Helvetica-Bold')
             .text(`${horas} hs`, hX + 12, y + 26, { width: halfW - 24 });
        }

        y += boxH + 12;
      }

      // Recomendaciones técnicas
      if (recomendaciones.length > 0) {
        doc.fillColor(BLUE).fontSize(11).font('Helvetica-Bold')
           .text('Recomendaciones técnicas', MARGIN, y);
        y += 16;

        recomendaciones.slice(0, 4).forEach(rec => {
          doc.circle(MARGIN + 6, y + 5, 3).fill(AMBER);
          doc.fillColor(DARK).fontSize(10).font('Helvetica')
             .text(rec, MARGIN + 16, y, { width: CW - 16 });
          const recLines = Math.ceil(rec.length / 80);
          y += Math.max(16, recLines * 14);
        });
        y += 8;
      }

      // MVP sugerido (compact on page 1)
      if (mvp) {
        doc.rect(MARGIN, y, CW, 4).fill(BLUE);
        y += 8;
        doc.fillColor(DARK_BLUE).fontSize(9).font('Helvetica-Bold')
           .text('MVP SUGERIDO', MARGIN, y, { letterSpacing: 1 });
        y += 14;
        doc.fillColor(DARK).fontSize(10).font('Helvetica')
           .text(mvp, MARGIN, y, { width: CW, align: 'justify' });
        const mvpLines = Math.ceil(mvp.length / 85);
        y += Math.max(16, mvpLines * 14) + 8;
      }
    }

    // ─── Funcionalidades ──────────────────────────────────────────────────────
    y += 4;
    doc.fillColor(BLUE).fontSize(13).font('Helvetica-Bold')
       .text('Funcionalidades incluidas', MARGIN, y);
    y += 22;

    const funcs = proyecto.funcionalidades || [];
    if (funcs.length > 0) {
      funcs.forEach(f => {
        if (y > 740) return; // safety: don't overflow page
        // Checkbox-like dot
        doc.circle(MARGIN + 6, y + 5, 4).fill(BLUE);
        doc.fillColor(DARK).fontSize(10.5).font('Helvetica')
           .text(f, MARGIN + 18, y, { width: CW - 18 });
        const fLines = Math.ceil(f.length / 80);
        y += Math.max(18, fLines * 14);
      });
    } else {
      doc.fillColor(GRAY).fontSize(10).text('A definir en la llamada inicial.', MARGIN + 18, y);
      y += 18;
    }

    // ─── Detalles del proyecto ─────────────────────────────────────────────────
    y += 12;
    if (y < 700) {
      doc.fillColor(BLUE).fontSize(13).font('Helvetica-Bold')
         .text('Detalles del proyecto', MARGIN, y);
      y += 20;

      const details = [
        ['Plataforma', proyecto.plataforma],
        ['Estado actual', proyecto.estado_actual],
        ['Plazo estimado', requisitos?.plazo],
        ['Presupuesto', requisitos?.presupuesto],
        ['Urgencia', requisitos?.urgencia],
        ['Stack sugerido', requisitos?.stack_sugerido],
      ].filter(([, v]) => v);

      // Two-column layout for details
      const colW = CW / 2 - 8;
      details.forEach(([label, value], idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const dx = MARGIN + col * (colW + 16);
        const dy = y + row * 32;
        if (dy > 740) return; // safety
        doc.rect(dx, dy, colW, 28).fill(LIGHT);
        doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold')
           .text(label.toUpperCase(), dx + 8, dy + 6, { width: colW - 16 });
        doc.fillColor(DARK).fontSize(10).font('Helvetica')
           .text(String(value), dx + 8, dy + 16, { width: colW - 16 });
      });
    }

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
      { n: '2', title: 'Propuesta formal', text: 'Te presento el presupuesto definitivo, el cronograma detallado y las opciones de pago.' },
      { n: '3', title: 'Desarrollo con avances', text: 'Trabajamos en sprints de 1 semana. Te mando demos funcionales para que vayas viendo el avance en tiempo real.' },
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

    // ─── Alcance del MVP (si existe) ──────────────────────────────────────────
    if (analisis?.mvp_sugerido) {
      sy += 10;
      doc.rect(MARGIN, sy, CW, 4).fill(GREEN);
      sy += 12;
      doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold')
         .text('Alcance del MVP', MARGIN, sy);
      sy += 20;
      doc.rect(MARGIN, sy, CW, 60).fill(LIGHT_GREEN);
      doc.fillColor(DARK).fontSize(10).font('Helvetica')
         .text(analisis.mvp_sugerido, MARGIN + 14, sy + 12, { width: CW - 28, align: 'justify' });
      sy += 70;
    }

    // ─── Timeline estimado (si hay horas) ─────────────────────────────────────
    if (analisis?.horas_estimadas) {
      sy += 10;
      doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold')
         .text('Cronograma estimado', MARGIN, sy);
      sy += 22;

      const totalHoras = analisis.horas_estimadas;
      const phases = [
        { phase: 'Semana 1-2', label: 'Setup + Diseño', pct: '20%', color: '#7c3aed' },
        { phase: 'Semana 3-6', label: 'Desarrollo core', pct: '55%', color: BLUE },
        { phase: 'Semana 7-8', label: 'Testing + Lanzamiento', pct: '25%', color: GREEN },
      ];

      // Timeline bar
      const barY = sy;
      const barH = 8;
      let barX = MARGIN;
      const barColors = ['#7c3aed', BLUE, GREEN];
      const barPcts = [0.2, 0.55, 0.25];
      barPcts.forEach((pct, i) => {
        const segW = CW * pct;
        doc.rect(barX, barY, segW, barH).fill(barColors[i]);
        barX += segW;
      });
      sy += barH + 14;

      phases.forEach(p => {
        doc.circle(MARGIN + 6, sy + 4, 4).fill(p.color);
        doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold')
           .text(p.phase, MARGIN + 16, sy, { continued: true })
           .font('Helvetica').fillColor(GRAY)
           .text(`  —  ${p.label} (${p.pct} del tiempo)`, { continued: false });
        sy += 18;
      });

      sy += 6;
      doc.fillColor(GRAY).fontSize(9).font('Helvetica')
         .text(`Total estimado: ~${totalHoras} horas de desarrollo`, MARGIN, sy);
      sy += 16;
    }

    // ─── CTA box ──────────────────────────────────────────────────────────────
    // Make sure CTA fits on page (position it at a known good location)
    const ctaY = Math.max(sy + 10, 580);
    if (ctaY < 720) {
      doc.rect(MARGIN, ctaY, CW, 100).fill(BLUE);
      doc.fillColor('white').fontSize(16).font('Helvetica-Bold')
         .text('¿Empezamos?', MARGIN + 20, ctaY + 18);
      doc.fillColor('white').fontSize(11).font('Helvetica').opacity(0.9)
         .text('Respondé este mensaje o mandame un WhatsApp y coordinamos una llamada de 30 minutos esta semana. Contesto el mismo día.', MARGIN + 20, ctaY + 42, { width: CW - 40 });
      doc.opacity(1);

      // Contact row
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold').opacity(0.7)
         .text('📱 WhatsApp  ·  📧 david.taranto@gmail.com  ·  💼 David Taranto — Desarrollador Freelance', MARGIN + 20, ctaY + 82, { width: CW - 40 });
      doc.opacity(1);
    }

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
