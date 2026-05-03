import Anthropic from '@anthropic-ai/sdk';
import type { ConversationReport } from './db';
import { escapeHtml as esc } from './utils';

let _anthropic: Anthropic | null = null;
function getClient() {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

export async function generateReport(
  history: Array<{ role: string; content: string }>,
  phone: string,
): Promise<ConversationReport> {
  const conversationText = history
    .map(m => `${m.role === 'user' ? 'Cliente' : 'Asistente'}: ${m.content}`)
    .join('\n');

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    system: `Sos un extractor y analista de información de proyectos de software. Analizá la conversación y devolvé ÚNICAMENTE un JSON válido (sin markdown, sin backticks) con esta estructura:
{
  "cliente": { "nombre": "", "telefono": "", "email": "", "contacto_extra": "", "rubro": "", "ubicacion": "", "tiene_negocio_existente": false, "nivel_tecnico": "bajo|medio|alto" },
  "proyecto": { "tipo": "", "descripcion": "", "funcionalidades": [], "estado_actual": "", "plataforma": "", "audiencia_objetivo": "", "modelo_negocio": "", "competencia_mencionada": "", "integraciones_necesarias": [], "requisitos_seguridad": "", "volumen_esperado": "" },
  "requisitos": { "plazo": "", "presupuesto": "", "urgencia": "", "stack_sugerido": "", "notas_adicionales": "" },
  "analisis": { "complejidad_estimada": "baja|media|alta|muy_alta", "horas_estimadas": "", "riesgos": [], "recomendaciones_tecnicas": [], "mvp_sugerido": "" },
  "resumen_ejecutivo": ""
}

INSTRUCCIONES:
1. INFERÍ información aunque no esté explícita (ej: "app de delivery" → mobile + comisión por pedido + integraciones de pago/envíos).
2. RESUMEN EJECUTIVO: 3-4 oraciones para David sobre qué necesita el cliente, qué lo hace complejo, approach recomendado, alcance.
3. COMPLEJIDAD: baja (pocas funcs, 1 plataforma), media (varias funcs + integraciones), alta (multi-plataforma + AI/real-time), muy_alta (todo + seguridad fuerte + alto volumen).
4. HORAS: rango aproximado tipo "120-180 horas".
5. RIESGOS y RECOMENDACIONES_TECNICAS: arrays de strings.
6. MVP_SUGERIDO: qué incluiría una primera versión mínima.

Extraé el nombre y email del cliente si los mencionó. Dejá vacío lo que no se mencionó (salvo lo que puedas inferir).`,
    messages: [{ role: 'user', content: conversationText }],
  });

  const block = response.content[0];
  const text = (block.type === 'text' ? block.text : '')
    .replace(/^```json?\n?/g, '')
    .replace(/\n?```$/g, '')
    .trim();

  let report: ConversationReport;
  try {
    report = JSON.parse(text) as ConversationReport;
  } catch (err) {
    throw new Error(`Error parseando reporte de Claude: ${(err as Error).message}. Respuesta: ${text.slice(0, 200)}`);
  }
  if (!report.cliente) report.cliente = {};
  (report.cliente as { telefono?: string }).telefono = phone;
  return report;
}

interface ReportLike {
  cliente?: Record<string, string | boolean | undefined>;
  proyecto?: { tipo?: string; descripcion?: string; funcionalidades?: string[]; estado_actual?: string; plataforma?: string; audiencia_objetivo?: string; modelo_negocio?: string; competencia_mencionada?: string; integraciones_necesarias?: string[]; requisitos_seguridad?: string; volumen_esperado?: string };
  requisitos?: { plazo?: string; presupuesto?: string; urgencia?: string; stack_sugerido?: string; notas_adicionales?: string };
  analisis?: { complejidad_estimada?: string; horas_estimadas?: string; riesgos?: string[]; recomendaciones_tecnicas?: string[]; mvp_sugerido?: string };
  resumen_ejecutivo?: string;
}

export function formatReportWhatsApp(report: ReportLike): string {
  const cliente = report.cliente || {};
  const proyecto = report.proyecto || {};
  const requisitos = report.requisitos || {};
  const analisis = report.analisis;
  const resumen = report.resumen_ejecutivo;

  const funcionalidades = proyecto.funcionalidades?.length
    ? proyecto.funcionalidades.map(f => `  • ${f}`).join('\n')
    : '  No especificadas';

  const integraciones = proyecto.integraciones_necesarias?.length
    ? proyecto.integraciones_necesarias.map(i => `  • ${i}`).join('\n') : null;

  const riesgos = analisis?.riesgos?.length
    ? analisis.riesgos.map(r => `  ⚠️ ${r}`).join('\n') : null;

  const recomendaciones = analisis?.recomendaciones_tecnicas?.length
    ? analisis.recomendaciones_tecnicas.map(r => `  💡 ${r}`).join('\n') : null;

  const contacto = [
    cliente.email ? `✉️ ${cliente.email}` : null,
    cliente.contacto_extra ? `📌 ${cliente.contacto_extra}` : null,
  ].filter(Boolean).join('\n');

  const clienteExtra = [
    cliente.rubro ? `*Rubro:* ${cliente.rubro}` : null,
    cliente.ubicacion ? `*Ubicación:* ${cliente.ubicacion}` : null,
    cliente.nivel_tecnico ? `*Nivel técnico:* ${cliente.nivel_tecnico}` : null,
  ].filter(Boolean).join('\n');

  return `📋 *Nuevo requisito — ${cliente.nombre || 'Sin nombre'}*
📱 ${cliente.telefono}
${contacto ? contacto + '\n' : ''}${clienteExtra ? clienteExtra + '\n' : ''}
*Qué necesitan:* ${proyecto.descripcion || 'No especificado'}

*Tipo:* ${proyecto.tipo || 'No especificado'}
*Plataforma:* ${proyecto.plataforma || 'No especificada'}
*Estado actual:* ${proyecto.estado_actual || 'No especificado'}

*Funcionalidades clave:*
${funcionalidades}
${integraciones ? `\n*Integraciones necesarias:*\n${integraciones}\n` : ''}
*Stack sugerido:* ${requisitos.stack_sugerido || 'No especificado'}
*Presupuesto:* ${requisitos.presupuesto || 'No mencionado'}
*Plazo:* ${requisitos.plazo || 'No especificado'}
${analisis ? `\n📊 *Análisis*\n*Complejidad:* ${analisis.complejidad_estimada || '—'}\n*Horas:* ${analisis.horas_estimadas || '—'}\n${riesgos ? `\n*Riesgos:*\n${riesgos}\n` : ''}${recomendaciones ? `\n*Recomendaciones:*\n${recomendaciones}\n` : ''}${analisis.mvp_sugerido ? `\n*MVP:* ${analisis.mvp_sugerido}\n` : ''}` : ''}
*Resumen:* ${resumen || 'Sin resumen'}`;
}

export function formatReportEmail(report: ReportLike): string {
  const cliente = report.cliente || {};
  const proyecto = report.proyecto || {};
  const requisitos = report.requisitos || {};
  const analisis = report.analisis;
  const resumen = report.resumen_ejecutivo;

  const funcionalidades = proyecto.funcionalidades?.length
    ? proyecto.funcionalidades.map(f => `<li>${esc(f)}</li>`).join('')
    : '<li>No especificadas</li>';

  const integraciones = proyecto.integraciones_necesarias?.length
    ? proyecto.integraciones_necesarias.map(i => `<li>${esc(i)}</li>`).join('') : null;

  const riesgos = analisis?.riesgos?.length
    ? analisis.riesgos.map(r => `<li>${esc(r)}</li>`).join('') : null;

  const recomendaciones = analisis?.recomendaciones_tecnicas?.length
    ? analisis.recomendaciones_tecnicas.map(r => `<li>${esc(r)}</li>`).join('') : null;

  const td = 'padding: 6px; border-bottom: 1px solid #eee;';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="border-bottom: 2px solid #2563eb; padding-bottom: 8px;">
    Nuevo requisito — ${esc(cliente.nombre) || 'Sin nombre'}
  </h2>
  <p><strong>Teléfono:</strong> ${esc(cliente.telefono)}</p>
  ${cliente.email ? `<p><strong>Email:</strong> ${esc(cliente.email)}</p>` : ''}
  ${cliente.rubro ? `<p><strong>Rubro:</strong> ${esc(cliente.rubro)}</p>` : ''}
  ${cliente.ubicacion ? `<p><strong>Ubicación:</strong> ${esc(cliente.ubicacion)}</p>` : ''}
  <h3>Proyecto</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="${td}"><strong>Tipo</strong></td><td style="${td}">${esc(proyecto.tipo) || '-'}</td></tr>
    <tr><td style="${td}"><strong>Descripción</strong></td><td style="${td}">${esc(proyecto.descripcion) || '-'}</td></tr>
    <tr><td style="${td}"><strong>Plataforma</strong></td><td style="${td}">${esc(proyecto.plataforma) || '-'}</td></tr>
    <tr><td style="${td}"><strong>Estado actual</strong></td><td style="${td}">${esc(proyecto.estado_actual) || '-'}</td></tr>
  </table>
  <h3>Funcionalidades</h3>
  <ul>${funcionalidades}</ul>
  ${integraciones ? `<h3>Integraciones</h3><ul>${integraciones}</ul>` : ''}
  <h3>Requisitos</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="${td}"><strong>Stack</strong></td><td style="${td}">${esc(requisitos.stack_sugerido) || '-'}</td></tr>
    <tr><td style="${td}"><strong>Presupuesto</strong></td><td style="${td}">${esc(requisitos.presupuesto) || '-'}</td></tr>
    <tr><td style="${td}"><strong>Plazo</strong></td><td style="${td}">${esc(requisitos.plazo) || '-'}</td></tr>
    <tr><td style="${td}"><strong>Notas</strong></td><td style="${td}">${esc(requisitos.notas_adicionales) || '-'}</td></tr>
  </table>
  ${analisis ? `<h3 style="border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">Análisis</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="${td}"><strong>Complejidad</strong></td><td style="${td}">${esc(analisis.complejidad_estimada) || '-'}</td></tr>
    <tr><td style="${td}"><strong>Horas</strong></td><td style="${td}">${esc(analisis.horas_estimadas) || '-'}</td></tr>
  </table>
  ${riesgos ? `<h4>Riesgos</h4><ul style="color:#dc2626;">${riesgos}</ul>` : ''}
  ${recomendaciones ? `<h4>Recomendaciones</h4><ul style="color:#059669;">${recomendaciones}</ul>` : ''}
  ${analisis.mvp_sugerido ? `<h4>MVP</h4><p style="background:#fefce8;padding:12px;border-radius:6px;">${esc(analisis.mvp_sugerido)}</p>` : ''}` : ''}
  <h3>Resumen ejecutivo</h3>
  <p style="background:#f0f7ff;padding:12px;border-radius:6px;">${esc(resumen) || 'Sin resumen'}</p>
</body></html>`;
}
