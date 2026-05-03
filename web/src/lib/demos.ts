import Anthropic from '@anthropic-ai/sdk';
import PDFDocument from 'pdfkit';
import type { ConversationReport } from './db';

let anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms)),
  ]);
}

// ============ 1. Demo visual del producto (landing HTML) ============
export async function generateLandingHTML(report: ConversationReport): Promise<string> {
  const cliente = report.cliente || {};
  const proyecto = report.proyecto || {};

  const prompt = `Sos un diseñador UI/UX experto de nivel senior. Tenés que crear una demo visual HTML de la PRIMERA PANTALLA del producto que un cliente le encargó a un desarrollador freelance.

NO hagas una "propuesta comercial" ni un resumen. Hacé una demo visual que parezca el producto REAL funcionando: la primera pantalla de la app/web/sistema que el cliente imaginó.

DATOS DEL PROYECTO:
- Cliente: ${cliente.nombre || 'Mi Negocio'}
- Rubro: ${cliente.rubro || 'no especificado'}
- Tipo: ${proyecto.tipo || 'web'}
- Descripción: ${proyecto.descripcion || ''}
- Plataforma: ${proyecto.plataforma || 'web'}
- Funcionalidades: ${(proyecto.funcionalidades || []).map((f, i) => (i + 1) + '. ' + f).join('\n  ')}
- Audiencia: ${proyecto.audiencia_objetivo || 'general'}
- Modelo de negocio: ${proyecto.modelo_negocio || ''}
- Integraciones: ${(proyecto.integraciones_necesarias || []).join(', ') || 'no especificadas'}
- Nivel técnico cliente: ${cliente.nivel_tecnico || 'medio'}

EJEMPLOS según tipo:
1. RESTAURANTE → Menú interactivo, cards de platos con emoji + precio + agregar, carrito flotante
2. TURNOS → Calendario clickeable, grilla de horarios, formulario lateral, confirmación con check
3. E-COMMERCE → Grid productos con foto (emoji), precio, descuento, botón agregar, filtros laterales, badges
4. LANDING → Hero con gradiente, CTA, beneficios con íconos, testimonios, pricing, footer
5. WHATSAPP BOT → Web de presentación: mockup celular con conversación, lista de funcs, "Cómo funciona" en 3 pasos
6. APP MÓVIL → Frame celular (390x844, border-radius:40px, status bar), bottom nav (4-5 tabs)
7. DASHBOARD → Sidebar oscuro con menú, métricas en cards, tabla con datos reales, gráfico CSS
8. DELIVERY → Buscador, categorías horizontales, cards de restaurantes con rating + tiempo + precio
9. SALUD → Dashboard paciente, búsqueda de condiciones, sidebar (Turnos, Recetas, Estudios), paleta azul/verde
10. EDUCACIÓN → Catálogo cursos, barra de progreso, video player, sidebar con módulos
11. FITNESS → Grilla clases semanales, planes de membresía, perfiles entrenadores, botón reservar
12. INMOBILIARIA → Búsqueda con filtros, cards de propiedades, mapa placeholder, listado
13. LEGAL → Portal cliente, sidebar (Casos, Documentos, Pagos), tabla con estado, look profesional
14. AGRO → Dashboard IoT, widgets de sensores, mapa de lotes, gráfico cosecha, paleta verde/tierra
15. VETERINARIA → Perfil mascota (nombre, raza, edad, emoji), agendar turno, historial, vet asignado
16. SaaS B2B → Pricing 3 columnas, tabla comparativa, preview dashboard, testimonios de empresas
17. SOCIAL → Feed con posts, sidebar trending, mensajes, perfil con stats
18. FINTECH → Balance prominente, historial transacciones, transferencia, tarjeta virtual, gráfico gastos
19. LOGÍSTICA → Tracking timeline, mapa ruta, lista envíos con filtros, dashboard flota
20. RRHH → Job board, pipeline candidatos kanban, calendario entrevistas
21. INVENTARIO → Tabla productos (SKU, nombre, stock, precio), alertas stock bajo rojo
22. RESERVAS → Calendario mensual/semanal, selector servicio, slots horarios, resumen confirmación

REGLAS TÉCNICAS:
- HTML5 completo autocontenido con <!DOCTYPE html>
- Tailwind CDN: <script src="https://cdn.tailwindcss.com"></script>
- NO imágenes externas. Usá emojis grandes, SVGs inline, gradientes
- Responsive mobile-first
- AL MENOS 3 secciones distintas
- Datos de ejemplo REALISTAS — nombres, precios, métricas reales para el rubro. NUNCA Lorem ipsum
- Terminología e íconos específicos del dominio
- Micro-interacciones CSS: hover, transitions, focus states
- 5-6 items mínimo (filas, cards, items) para sentirse real
- Paleta según industria
- JavaScript inline para tabs/toggles (sin fetch)
- Pie discreto: "Demo generada por David Taranto · Desarrollador freelance"
- Idioma: español argentino

DEVOLVÉ ÚNICAMENTE EL HTML, sin markdown, sin backticks, sin explicaciones.`;

  const apiCall = getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const response = await withTimeout(apiCall, 60000, 'generateLandingHTML');
  const block = response.content[0];
  let html = (block.type === 'text' ? block.text : '').trim();
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/, '').trim();
  return html;
}

// ============ 2. Mockup de WhatsApp como HTML ============
export async function generateWhatsappMockup(report: ConversationReport): Promise<Buffer> {
  const cliente = report.cliente || {};
  const proyecto = report.proyecto || {};

  const prompt = `Armá una conversación realista de WhatsApp (8-12 mensajes) entre un cliente REAL y el bot de WhatsApp de "${cliente.nombre || 'este negocio'}".

Esta es una DEMO del bot que se va a construir. Mostrá cómo quedaría una vez listo.

Proyecto: ${proyecto.tipo || 'negocio'}
Rubro: ${cliente.rubro || 'no especificado'}
Descripción: ${proyecto.descripcion || ''}
Funcionalidades del bot: ${(proyecto.funcionalidades || []).join(', ')}

REGLAS:
- Cliente hace consultas REALES del negocio (no "hola" genérico)
- Bot responde útil, eficiente, con tono del negocio
- Mostrá al menos 2 funcionalidades DISTINTAS
- Mensajes cortos, naturales, argentinos ("vos", "dale", "te paso")
- Bot específico del negocio, no genérico
- Formato: *texto* para bold (precios, nombres, fechas), \\n para listas, [Opción] para botones
- Personalidad según tipo de negocio
- Cliente reacciona positivo al menos una vez
- Flujo: consulta → respuesta → seguimiento → cierre

DEVOLVÉ JSON puro (sin markdown):
{"messages": [{"from": "client", "text": "..."}, {"from": "bot", "text": "..."}]}`;

  const apiCall = getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const response = await withTimeout(apiCall, 30000, 'generateWhatsappMockup');
  const block = response.content[0];
  const jsonText = (block.type === 'text' ? block.text : '').trim()
    .replace(/^```json?\n?/i, '').replace(/\n?```$/, '').trim();

  let conv: { messages: { from: string; text: string }[] };
  try {
    conv = JSON.parse(jsonText);
  } catch {
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
    safe = safe.replace(/\*([^*]+)\*/g, '<b>$1</b>');
    safe = safe.replace(/\\n/g, '<br>');
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

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demo WhatsApp — ${businessName}</title>
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
</style></head><body>
<div class="phone">
  <div class="header">
    <div class="avatar">${initial}</div>
    <div class="hinfo"><div class="name">${businessName}</div><div class="status">en línea</div></div>
  </div>
  <div class="chat"><div class="date-chip"><span>Hoy</span></div>${bubbles}</div>
  <div class="footer"><div class="footer-input">Escribí un mensaje...</div><div class="footer-btn">➤</div></div>
  <div class="label">Vista previa del asistente de WhatsApp • Desarrollado por David Taranto</div>
</div></body></html>`;

  return Buffer.from(html, 'utf-8');
}

// ============ 3. Mini-propuesta PDF ============
export async function generateMiniPDF(report: ConversationReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const cliente = report.cliente || {};
    const proyecto = report.proyecto || {};
    const requisitos = report.requisitos || {};
    const resumen = report.resumen_ejecutivo;
    const analisis = report.analisis;

    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c as Buffer));
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

    // Page 1 — Header
    doc.rect(0, 0, W, 180).fill(BLUE);
    doc.circle(W - 60, 30, 110).fillOpacity(0.08).fill('white');
    doc.fillOpacity(1);
    doc.fillColor('white').fontSize(10).font('Helvetica').opacity(0.7).text('PROPUESTA DE PROYECTO', MARGIN, 45, { characterSpacing: 2 });
    doc.opacity(1);
    doc.fontSize(26).font('Helvetica-Bold').fillColor('white').text(cliente.nombre || 'Cliente', MARGIN, 65, { width: CW - 80 });
    doc.fontSize(13).font('Helvetica').fillColor('white').opacity(0.85).text(proyecto.tipo || 'Desarrollo a medida', MARGIN, 105, { width: CW });
    doc.opacity(1);
    const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.fontSize(9).fillColor('white').opacity(0.6).text(`Preparado por David Taranto  ·  ${fecha}`, MARGIN, 150, { width: CW });
    doc.opacity(1);

    // Resumen ejecutivo
    const summaryText = resumen || proyecto.descripcion || 'Proyecto a medida según requerimientos acordados.';
    const summaryLines = Math.ceil(summaryText.length / 90);
    const summaryH = Math.max(70, summaryLines * 16 + 30);
    doc.rect(MARGIN, 200, CW, summaryH).fill(LIGHT_BLUE);
    doc.fillColor(DARK_BLUE).fontSize(9).font('Helvetica-Bold').text('LO QUE ENTENDÍ DE TU PROYECTO', MARGIN + 16, 215, { characterSpacing: 1 });
    doc.fillColor(DARK).fontSize(11).font('Helvetica').text(summaryText, MARGIN + 16, 232, { width: CW - 32, align: 'justify' });

    let y = 200 + summaryH + 16;

    if (analisis) {
      const complejidad = analisis.complejidad_estimada || null;
      const horas = analisis.horas_estimadas || null;
      const recomendaciones = analisis.recomendaciones_tecnicas || [];
      const mvp = analisis.mvp_sugerido || null;

      if (complejidad || horas) {
        const boxH = 50;
        const halfW = (CW - 12) / 2;
        if (complejidad) {
          const compColor = complejidad.toLowerCase().includes('alta') ? '#dc2626' : complejidad.toLowerCase().includes('media') ? AMBER : GREEN;
          const compBg = complejidad.toLowerCase().includes('alta') ? '#fef2f2' : complejidad.toLowerCase().includes('media') ? LIGHT_AMBER : LIGHT_GREEN;
          doc.rect(MARGIN, y, halfW, boxH).fill(compBg);
          doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold').text('COMPLEJIDAD ESTIMADA', MARGIN + 12, y + 10, { characterSpacing: 1 });
          doc.fillColor(compColor).fontSize(16).font('Helvetica-Bold').text(complejidad, MARGIN + 12, y + 26, { width: halfW - 24 });
        }
        if (horas) {
          const hX = MARGIN + halfW + 12;
          doc.rect(hX, y, halfW, boxH).fill(LIGHT_GREEN);
          doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold').text('HORAS ESTIMADAS', hX + 12, y + 10, { characterSpacing: 1 });
          doc.fillColor(GREEN).fontSize(16).font('Helvetica-Bold').text(`${horas} hs`, hX + 12, y + 26, { width: halfW - 24 });
        }
        y += boxH + 12;
      }

      if (recomendaciones.length > 0) {
        doc.fillColor(BLUE).fontSize(11).font('Helvetica-Bold').text('Recomendaciones técnicas', MARGIN, y);
        y += 16;
        recomendaciones.slice(0, 4).forEach(rec => {
          doc.circle(MARGIN + 6, y + 5, 3).fill(AMBER);
          doc.fillColor(DARK).fontSize(10).font('Helvetica').text(rec, MARGIN + 16, y, { width: CW - 16 });
          const recLines = Math.ceil(rec.length / 80);
          y += Math.max(16, recLines * 14);
        });
        y += 8;
      }

      if (mvp) {
        doc.rect(MARGIN, y, CW, 4).fill(BLUE);
        y += 8;
        doc.fillColor(DARK_BLUE).fontSize(9).font('Helvetica-Bold').text('MVP SUGERIDO', MARGIN, y, { characterSpacing: 1 });
        y += 14;
        doc.fillColor(DARK).fontSize(10).font('Helvetica').text(mvp, MARGIN, y, { width: CW, align: 'justify' });
        const mvpLines = Math.ceil(mvp.length / 85);
        y += Math.max(16, mvpLines * 14) + 8;
      }
    }

    // Funcionalidades
    y += 4;
    doc.fillColor(BLUE).fontSize(13).font('Helvetica-Bold').text('Funcionalidades incluidas', MARGIN, y);
    y += 22;
    const funcs = proyecto.funcionalidades || [];
    if (funcs.length > 0) {
      funcs.forEach(f => {
        if (y > 740) return;
        doc.circle(MARGIN + 6, y + 5, 4).fill(BLUE);
        doc.fillColor(DARK).fontSize(10.5).font('Helvetica').text(f, MARGIN + 18, y, { width: CW - 18 });
        const fLines = Math.ceil(f.length / 80);
        y += Math.max(18, fLines * 14);
      });
    } else {
      doc.fillColor(GRAY).fontSize(10).text('A definir en la llamada inicial.', MARGIN + 18, y);
      y += 18;
    }

    // Detalles
    y += 12;
    if (y < 700) {
      doc.fillColor(BLUE).fontSize(13).font('Helvetica-Bold').text('Detalles del proyecto', MARGIN, y);
      y += 20;
      const details: [string, string | undefined][] = [
        ['Plataforma', proyecto.plataforma],
        ['Estado actual', proyecto.estado_actual],
        ['Plazo estimado', requisitos.plazo],
        ['Presupuesto', requisitos.presupuesto],
        ['Urgencia', requisitos.urgencia],
        ['Stack sugerido', requisitos.stack_sugerido],
      ];
      const filtered = details.filter(([, v]) => v) as [string, string][];
      const colW = CW / 2 - 8;
      filtered.forEach(([label, value], idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const dx = MARGIN + col * (colW + 16);
        const dy = y + row * 32;
        if (dy > 740) return;
        doc.rect(dx, dy, colW, 28).fill(LIGHT);
        doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold').text(label.toUpperCase(), dx + 8, dy + 6, { width: colW - 16 });
        doc.fillColor(DARK).fontSize(10).font('Helvetica').text(value, dx + 8, dy + 16, { width: colW - 16 });
      });
    }

    // Page 2
    doc.addPage();
    doc.rect(0, 0, W, 6).fill(BLUE);
    doc.fillColor(DARK).fontSize(20).font('Helvetica-Bold').text('Cómo vamos a trabajar', MARGIN, 30);
    doc.fillColor(GRAY).fontSize(11).font('Helvetica').text('Mi proceso es simple, con avances continuos para que siempre sepas cómo avanza tu proyecto.', MARGIN, 58, { width: CW });

    let sy = 100;
    const steps = [
      { n: '1', title: 'Llamada inicial (30 min)', text: 'Alineamos requisitos, alcance, tiempos y dudas. Sin costo, sin compromiso.' },
      { n: '2', title: 'Propuesta formal', text: 'Presupuesto definitivo, cronograma detallado y opciones de pago.' },
      { n: '3', title: 'Desarrollo con avances', text: 'Sprints de 1 semana. Te mando demos funcionales para ver el avance en tiempo real.' },
      { n: '4', title: 'Entrega + soporte 30 días', text: 'Puesta en producción, capacitación y soporte técnico durante el primer mes.' },
    ];
    steps.forEach(s => {
      doc.circle(MARGIN + 14, sy + 12, 14).fill(BLUE);
      doc.fillColor('white').fontSize(12).font('Helvetica-Bold').text(s.n, MARGIN + 9, sy + 7);
      if (s.n !== '4') {
        doc.moveTo(MARGIN + 14, sy + 26).lineTo(MARGIN + 14, sy + 60).stroke('#cbd5e1');
      }
      doc.fillColor(DARK).fontSize(12).font('Helvetica-Bold').text(s.title, MARGIN + 36, sy, { width: CW - 36 });
      doc.fillColor(GRAY).fontSize(10).font('Helvetica').text(s.text, MARGIN + 36, sy + 16, { width: CW - 36 });
      sy += 65;
    });

    if (analisis?.mvp_sugerido) {
      sy += 10;
      doc.rect(MARGIN, sy, CW, 4).fill(GREEN);
      sy += 12;
      doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text('Alcance del MVP', MARGIN, sy);
      sy += 20;
      doc.rect(MARGIN, sy, CW, 60).fill(LIGHT_GREEN);
      doc.fillColor(DARK).fontSize(10).font('Helvetica').text(analisis.mvp_sugerido, MARGIN + 14, sy + 12, { width: CW - 28, align: 'justify' });
      sy += 70;
    }

    if (analisis?.horas_estimadas) {
      sy += 10;
      doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text('Cronograma estimado', MARGIN, sy);
      sy += 22;
      const phases = [
        { phase: 'Semana 1-2', label: 'Setup + Diseño', pct: '20%', color: '#7c3aed' },
        { phase: 'Semana 3-6', label: 'Desarrollo core', pct: '55%', color: BLUE },
        { phase: 'Semana 7-8', label: 'Testing + Lanzamiento', pct: '25%', color: GREEN },
      ];
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
        doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text(p.phase, MARGIN + 16, sy, { continued: true })
          .font('Helvetica').fillColor(GRAY).text(`  —  ${p.label} (${p.pct} del tiempo)`, { continued: false });
        sy += 18;
      });
      sy += 6;
      doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(`Total estimado: ~${analisis.horas_estimadas} horas de desarrollo`, MARGIN, sy);
      sy += 16;
    }

    const ctaY = Math.max(sy + 10, 580);
    if (ctaY < 720) {
      doc.rect(MARGIN, ctaY, CW, 100).fill(BLUE);
      doc.fillColor('white').fontSize(16).font('Helvetica-Bold').text('¿Empezamos?', MARGIN + 20, ctaY + 18);
      doc.fillColor('white').fontSize(11).font('Helvetica').opacity(0.9).text('Respondé este mensaje o mandame un WhatsApp y coordinamos una llamada de 30 minutos esta semana. Contesto el mismo día.', MARGIN + 20, ctaY + 42, { width: CW - 40 });
      doc.opacity(1);
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold').opacity(0.7).text('WhatsApp  |  david.taranto@gmail.com  |  David Taranto — Desarrollador Freelance', MARGIN + 20, ctaY + 82, { width: CW - 40 });
      doc.opacity(1);
    }

    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text('David Taranto · Desarrollo de software a medida · Salta, Argentina', MARGIN, 800, { width: CW, align: 'center' });
    doc.end();
  });
}

export function detectDemoTypes(report: ConversationReport): { landing: boolean; whatsapp: boolean } {
  const tipo = (report.proyecto?.tipo || '').toLowerCase();
  const descripcion = (report.proyecto?.descripcion || '').toLowerCase();
  const plataforma = (report.proyecto?.plataforma || '').toLowerCase();
  const funcionales = (report.proyecto?.funcionalidades || []).join(' ').toLowerCase();
  const allText = [tipo, descripcion, plataforma, funcionales].join(' ');

  const waBotPattern = /chatbot|bot\s+de\s+whatsapp|bot\s+de\s+mensajes|asistente\s+autom[aá]tico|automatizaci[oó]n\s+de\s+(whatsapp|mensajes)|respuestas\s+autom[aá]ticas|asistente\s+de\s+whatsapp|(?<![a-záéíóúüñ])bot(?![a-záéíóúüñ])/i;
  const webKeywords = ['web', 'página', 'pagina', 'sitio', 'landing', 'tienda', 'shop', 'ecommerce', 'e-commerce', 'app', 'aplicación', 'aplicacion', 'sistema', 'dashboard', 'panel', 'gestión', 'gestion', 'plataforma'];

  const needsWA = waBotPattern.test(allText);
  const needsWeb = webKeywords.some(k => allText.includes(k));

  return { landing: needsWeb || !needsWA, whatsapp: needsWA };
}

export async function generateAllDemos(report: ConversationReport) {
  const demos = detectDemoTypes(report);
  console.log(`[demos] Tipo: "${report.proyecto?.tipo}" → landing:${demos.landing} WA:${demos.whatsapp}`);

  const [landingHTML, whatsappPng, pdfBuffer] = await Promise.all([
    demos.landing
      ? generateLandingHTML(report).catch(err => { console.error('Error landing:', err); return null; })
      : Promise.resolve(null),
    demos.whatsapp
      ? generateWhatsappMockup(report).catch(err => { console.error('Error WA mockup:', err); return null; })
      : Promise.resolve(null),
    generateMiniPDF(report).catch(err => { console.error('Error PDF:', err); return null; }),
  ]);

  return { landingHTML, whatsappPng, pdfBuffer };
}
