const Anthropic = require('@anthropic-ai/sdk');

let _anthropic = null;
function getClient() {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

// Extrae info estructurada de la conversación usando una llamada separada a Claude
async function generateReport(history, phone) {
  const conversationText = history
    .map(m => `${m.role === 'user' ? 'Cliente' : 'Asistente'}: ${m.content}`)
    .join('\n');

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: `Sos un extractor de información. Analizá la conversación y devolvé ÚNICAMENTE un JSON válido (sin markdown, sin backticks) con esta estructura:
{
  "cliente": { "nombre": "", "telefono": "", "email": "", "contacto_extra": "" },
  "proyecto": {
    "tipo": "",
    "descripcion": "",
    "funcionalidades": [],
    "estado_actual": "",
    "plataforma": ""
  },
  "requisitos": {
    "plazo": "",
    "presupuesto": "",
    "urgencia": "",
    "stack_sugerido": "",
    "notas_adicionales": ""
  },
  "resumen_ejecutivo": ""
}
Completá lo que puedas extraer de la conversación. Dejá vacío lo que no se mencionó.
IMPORTANTE: Extraé el nombre del cliente si lo mencionó en la conversación. Si mencionó un email o forma de contacto, poné en "email" o "contacto_extra".
El resumen_ejecutivo es un párrafo breve para David (el desarrollador).`,
    messages: [{ role: 'user', content: conversationText }],
  });

  const text = response.content[0].text
    .replace(/^```json?\n?/g, '')
    .replace(/\n?```$/g, '')
    .trim();

  let report;
  try {
    report = JSON.parse(text);
  } catch (err) {
    throw new Error(`Error parseando reporte de Claude: ${err.message}. Respuesta: ${text.slice(0, 200)}`);
  }
  report.cliente.telefono = phone;
  return report;
}

// Formato para mandar por WhatsApp a David
function formatReportWhatsApp(report) {
  const { cliente, proyecto, requisitos, resumen_ejecutivo } = report;
  const funcionalidades = proyecto.funcionalidades?.length
    ? proyecto.funcionalidades.map(f => `  • ${f}`).join('\n')
    : '  No especificadas';

  const contacto = [
    cliente.email ? `✉️ ${cliente.email}` : null,
    cliente.contacto_extra ? `📌 ${cliente.contacto_extra}` : null,
  ].filter(Boolean).join('\n');

  return `📋 *Nuevo requisito — ${cliente.nombre || 'Sin nombre'}*
📱 ${cliente.telefono}
${contacto ? contacto + '\n' : ''}
*Qué necesitan:* ${proyecto.descripcion || 'No especificado'}

*Tipo:* ${proyecto.tipo || 'No especificado'}
*Plataforma:* ${proyecto.plataforma || 'No especificada'}
*Estado actual:* ${proyecto.estado_actual || 'No especificado'}

*Funcionalidades clave:*
${funcionalidades}

*Stack sugerido:* ${requisitos.stack_sugerido || 'No especificado'}
*Presupuesto:* ${requisitos.presupuesto || 'No mencionado'}
*Plazo:* ${requisitos.plazo || 'No especificado'}
*Urgencia:* ${requisitos.urgencia || 'No especificada'}

*Notas:* ${requisitos.notas_adicionales || 'Ninguna'}

*Resumen:* ${resumen_ejecutivo || 'Sin resumen'}`;
}

// Formato HTML para email
function formatReportEmail(report) {
  const { cliente, proyecto, requisitos, resumen_ejecutivo } = report;

  // HTML escape helper to prevent XSS
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const funcionalidades = proyecto.funcionalidades?.length
    ? proyecto.funcionalidades.map(f => `<li>${esc(f)}</li>`).join('')
    : '<li>No especificadas</li>';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="border-bottom: 2px solid #2563eb; padding-bottom: 8px;">
    Nuevo requisito — ${esc(cliente.nombre) || 'Sin nombre'}
  </h2>
  <p><strong>Teléfono:</strong> ${esc(cliente.telefono)}</p>
  ${cliente.email ? `<p><strong>Email:</strong> ${esc(cliente.email)}</p>` : ''}
  ${cliente.contacto_extra ? `<p><strong>Contacto extra:</strong> ${esc(cliente.contacto_extra)}</p>` : ''}

  <h3>Proyecto</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 6px; border-bottom: 1px solid #eee;"><strong>Tipo</strong></td><td style="padding: 6px; border-bottom: 1px solid #eee;">${esc(proyecto.tipo) || '-'}</td></tr>
    <tr><td style="padding: 6px; border-bottom: 1px solid #eee;"><strong>Descripción</strong></td><td style="padding: 6px; border-bottom: 1px solid #eee;">${esc(proyecto.descripcion) || '-'}</td></tr>
    <tr><td style="padding: 6px; border-bottom: 1px solid #eee;"><strong>Plataforma</strong></td><td style="padding: 6px; border-bottom: 1px solid #eee;">${esc(proyecto.plataforma) || '-'}</td></tr>
    <tr><td style="padding: 6px; border-bottom: 1px solid #eee;"><strong>Estado actual</strong></td><td style="padding: 6px; border-bottom: 1px solid #eee;">${esc(proyecto.estado_actual) || '-'}</td></tr>
  </table>

  <h3>Funcionalidades</h3>
  <ul>${funcionalidades}</ul>

  <h3>Requisitos</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 6px; border-bottom: 1px solid #eee;"><strong>Stack sugerido</strong></td><td style="padding: 6px; border-bottom: 1px solid #eee;">${esc(requisitos.stack_sugerido) || '-'}</td></tr>
    <tr><td style="padding: 6px; border-bottom: 1px solid #eee;"><strong>Presupuesto</strong></td><td style="padding: 6px; border-bottom: 1px solid #eee;">${esc(requisitos.presupuesto) || '-'}</td></tr>
    <tr><td style="padding: 6px; border-bottom: 1px solid #eee;"><strong>Plazo</strong></td><td style="padding: 6px; border-bottom: 1px solid #eee;">${esc(requisitos.plazo) || '-'}</td></tr>
    <tr><td style="padding: 6px; border-bottom: 1px solid #eee;"><strong>Urgencia</strong></td><td style="padding: 6px; border-bottom: 1px solid #eee;">${esc(requisitos.urgencia) || '-'}</td></tr>
    <tr><td style="padding: 6px; border-bottom: 1px solid #eee;"><strong>Notas</strong></td><td style="padding: 6px; border-bottom: 1px solid #eee;">${esc(requisitos.notas_adicionales) || '-'}</td></tr>
  </table>

  <h3>Resumen ejecutivo</h3>
  <p style="background: #f0f7ff; padding: 12px; border-radius: 6px;">${esc(resumen_ejecutivo) || 'Sin resumen'}</p>
</body>
</html>`;
}

module.exports = { generateReport, formatReportWhatsApp, formatReportEmail };
