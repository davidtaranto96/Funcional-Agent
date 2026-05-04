// @ts-nocheck
import Anthropic from '@anthropic-ai/sdk';

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
    max_tokens: 3000,
    system: `Sos un extractor y analista de información de proyectos de software. Analizá la conversación y devolvé ÚNICAMENTE un JSON válido (sin markdown, sin backticks) con esta estructura:
{
  "cliente": {
    "nombre": "",
    "telefono": "",
    "email": "",
    "contacto_extra": "",
    "rubro": "",
    "ubicacion": "",
    "tiene_negocio_existente": false,
    "nivel_tecnico": "bajo|medio|alto"
  },
  "proyecto": {
    "tipo": "",
    "descripcion": "",
    "funcionalidades": [],
    "estado_actual": "",
    "plataforma": "",
    "audiencia_objetivo": "",
    "modelo_negocio": "",
    "competencia_mencionada": "",
    "integraciones_necesarias": [],
    "requisitos_seguridad": "",
    "volumen_esperado": ""
  },
  "requisitos": {
    "plazo": "",
    "presupuesto": "",
    "urgencia": "",
    "stack_sugerido": "",
    "notas_adicionales": ""
  },
  "analisis": {
    "complejidad_estimada": "baja|media|alta|muy_alta",
    "horas_estimadas": "",
    "riesgos": [],
    "recomendaciones_tecnicas": [],
    "mvp_sugerido": ""
  },
  "resumen_ejecutivo": ""
}

INSTRUCCIONES DETALLADAS:

1. INFERÍ información aunque no esté explícita. Ejemplos:
   - "app de delivery" → plataforma: "mobile (iOS + Android)", audiencia_objetivo: "consumidores generales", modelo_negocio: "comisión por pedido"
   - "e-commerce" → integraciones_necesarias: ["pasarela de pago", "envíos"], requisitos_seguridad: "datos de pago, PCI compliance"
   - "quiero algo como Rappi" → competencia_mencionada: "Rappi"
   - Si el cliente habla con términos técnicos → nivel_tecnico: "alto"; si no sabe nada de tech → "bajo"

2. RESUMEN EJECUTIVO: Escribí 3-4 oraciones para David (el desarrollador):
   - Qué necesita el cliente concretamente
   - Qué lo hace complejo o interesante
   - Enfoque/approach recomendado
   - Alcance estimado (chico, mediano, grande)

3. ANÁLISIS DE COMPLEJIDAD (analisis.complejidad_estimada):
   - "baja": pocas funcionalidades, una plataforma, sin integraciones complejas
   - "media": varias funcionalidades, una plataforma, algunas integraciones
   - "alta": muchas funcionalidades, multi-plataforma (web+mobile), integraciones complejas, features de AI o real-time
   - "muy_alta": todo lo anterior + requisitos de seguridad fuertes, alto volumen, múltiples roles de usuario

4. HORAS ESTIMADAS (analisis.horas_estimadas): Dá un rango aproximado como "120-180 horas", "40-60 horas", etc.

5. RIESGOS (analisis.riesgos): Array de strings con problemas potenciales. Ej: "Scope creep por falta de definición", "Dependencia de API de terceros", "Requisitos de performance no definidos".

6. RECOMENDACIONES TÉCNICAS (analisis.recomendaciones_tecnicas): Array de strings con sugerencias de stack/approach. Ej: "Usar Next.js para SSR y SEO", "React Native para cubrir ambas plataformas mobile".

7. MVP SUGERIDO (analisis.mvp_sugerido): Describí qué incluiría una primera versión mínima viable.

Completá lo que puedas extraer de la conversación. Dejá vacío lo que no se mencionó (salvo lo que puedas inferir).
IMPORTANTE: Extraé el nombre del cliente si lo mencionó en la conversación. Si mencionó un email o forma de contacto, poné en "email" o "contacto_extra".`,
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
  const { cliente, proyecto, requisitos, analisis, resumen_ejecutivo } = report;
  const funcionalidades = proyecto.funcionalidades?.length
    ? proyecto.funcionalidades.map(f => `  • ${f}`).join('\n')
    : '  No especificadas';

  const integraciones = proyecto.integraciones_necesarias?.length
    ? proyecto.integraciones_necesarias.map(i => `  • ${i}`).join('\n')
    : null;

  const riesgos = analisis?.riesgos?.length
    ? analisis.riesgos.map(r => `  ⚠️ ${r}`).join('\n')
    : null;

  const recomendaciones = analisis?.recomendaciones_tecnicas?.length
    ? analisis.recomendaciones_tecnicas.map(r => `  💡 ${r}`).join('\n')
    : null;

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
${proyecto.audiencia_objetivo ? `*Audiencia:* ${proyecto.audiencia_objetivo}\n` : ''}${proyecto.modelo_negocio ? `*Modelo de negocio:* ${proyecto.modelo_negocio}\n` : ''}${proyecto.competencia_mencionada ? `*Competencia:* ${proyecto.competencia_mencionada}\n` : ''}
*Funcionalidades clave:*
${funcionalidades}
${integraciones ? `\n*Integraciones necesarias:*\n${integraciones}\n` : ''}
*Stack sugerido:* ${requisitos.stack_sugerido || 'No especificado'}
*Presupuesto:* ${requisitos.presupuesto || 'No mencionado'}
*Plazo:* ${requisitos.plazo || 'No especificado'}
*Urgencia:* ${requisitos.urgencia || 'No especificada'}

*Notas:* ${requisitos.notas_adicionales || 'Ninguna'}
${analisis ? `
📊 *Análisis*
*Complejidad:* ${analisis.complejidad_estimada || 'No estimada'}
*Horas estimadas:* ${analisis.horas_estimadas || 'No estimadas'}
${riesgos ? `\n*Riesgos:*\n${riesgos}\n` : ''}${recomendaciones ? `\n*Recomendaciones técnicas:*\n${recomendaciones}\n` : ''}${analisis.mvp_sugerido ? `\n*MVP sugerido:* ${analisis.mvp_sugerido}\n` : ''}` : ''}
*Resumen:* ${resumen_ejecutivo || 'Sin resumen'}`;
}

// Formato HTML para email
function formatReportEmail(report) {
  const { cliente, proyecto, requisitos, analisis, resumen_ejecutivo } = report;

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

  const integraciones = proyecto.integraciones_necesarias?.length
    ? proyecto.integraciones_necesarias.map(i => `<li>${esc(i)}</li>`).join('')
    : null;

  const riesgos = analisis?.riesgos?.length
    ? analisis.riesgos.map(r => `<li>${esc(r)}</li>`).join('')
    : null;

  const recomendaciones = analisis?.recomendaciones_tecnicas?.length
    ? analisis.recomendaciones_tecnicas.map(r => `<li>${esc(r)}</li>`).join('')
    : null;

  const tdStyle = 'padding: 6px; border-bottom: 1px solid #eee;';

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
  ${cliente.rubro ? `<p><strong>Rubro:</strong> ${esc(cliente.rubro)}</p>` : ''}
  ${cliente.ubicacion ? `<p><strong>Ubicación:</strong> ${esc(cliente.ubicacion)}</p>` : ''}
  ${cliente.nivel_tecnico ? `<p><strong>Nivel técnico:</strong> ${esc(cliente.nivel_tecnico)}</p>` : ''}

  <h3>Proyecto</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="${tdStyle}"><strong>Tipo</strong></td><td style="${tdStyle}">${esc(proyecto.tipo) || '-'}</td></tr>
    <tr><td style="${tdStyle}"><strong>Descripción</strong></td><td style="${tdStyle}">${esc(proyecto.descripcion) || '-'}</td></tr>
    <tr><td style="${tdStyle}"><strong>Plataforma</strong></td><td style="${tdStyle}">${esc(proyecto.plataforma) || '-'}</td></tr>
    <tr><td style="${tdStyle}"><strong>Estado actual</strong></td><td style="${tdStyle}">${esc(proyecto.estado_actual) || '-'}</td></tr>
    ${proyecto.audiencia_objetivo ? `<tr><td style="${tdStyle}"><strong>Audiencia objetivo</strong></td><td style="${tdStyle}">${esc(proyecto.audiencia_objetivo)}</td></tr>` : ''}
    ${proyecto.modelo_negocio ? `<tr><td style="${tdStyle}"><strong>Modelo de negocio</strong></td><td style="${tdStyle}">${esc(proyecto.modelo_negocio)}</td></tr>` : ''}
    ${proyecto.competencia_mencionada ? `<tr><td style="${tdStyle}"><strong>Competencia</strong></td><td style="${tdStyle}">${esc(proyecto.competencia_mencionada)}</td></tr>` : ''}
    ${proyecto.requisitos_seguridad ? `<tr><td style="${tdStyle}"><strong>Requisitos de seguridad</strong></td><td style="${tdStyle}">${esc(proyecto.requisitos_seguridad)}</td></tr>` : ''}
    ${proyecto.volumen_esperado ? `<tr><td style="${tdStyle}"><strong>Volumen esperado</strong></td><td style="${tdStyle}">${esc(proyecto.volumen_esperado)}</td></tr>` : ''}
  </table>

  <h3>Funcionalidades</h3>
  <ul>${funcionalidades}</ul>

  ${integraciones ? `<h3>Integraciones necesarias</h3><ul>${integraciones}</ul>` : ''}

  <h3>Requisitos</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="${tdStyle}"><strong>Stack sugerido</strong></td><td style="${tdStyle}">${esc(requisitos.stack_sugerido) || '-'}</td></tr>
    <tr><td style="${tdStyle}"><strong>Presupuesto</strong></td><td style="${tdStyle}">${esc(requisitos.presupuesto) || '-'}</td></tr>
    <tr><td style="${tdStyle}"><strong>Plazo</strong></td><td style="${tdStyle}">${esc(requisitos.plazo) || '-'}</td></tr>
    <tr><td style="${tdStyle}"><strong>Urgencia</strong></td><td style="${tdStyle}">${esc(requisitos.urgencia) || '-'}</td></tr>
    <tr><td style="${tdStyle}"><strong>Notas</strong></td><td style="${tdStyle}">${esc(requisitos.notas_adicionales) || '-'}</td></tr>
  </table>

  ${analisis ? `
  <h3 style="border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">Análisis técnico</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="${tdStyle}"><strong>Complejidad estimada</strong></td><td style="${tdStyle}">${esc(analisis.complejidad_estimada) || '-'}</td></tr>
    <tr><td style="${tdStyle}"><strong>Horas estimadas</strong></td><td style="${tdStyle}">${esc(analisis.horas_estimadas) || '-'}</td></tr>
  </table>
  ${riesgos ? `<h4>Riesgos identificados</h4><ul style="color: #dc2626;">${riesgos}</ul>` : ''}
  ${recomendaciones ? `<h4>Recomendaciones técnicas</h4><ul style="color: #059669;">${recomendaciones}</ul>` : ''}
  ${analisis.mvp_sugerido ? `<h4>MVP sugerido</h4><p style="background: #fefce8; padding: 12px; border-radius: 6px;">${esc(analisis.mvp_sugerido)}</p>` : ''}
  ` : ''}

  <h3>Resumen ejecutivo</h3>
  <p style="background: #f0f7ff; padding: 12px; border-radius: 6px;">${esc(resumen_ejecutivo) || 'Sin resumen'}</p>
</body>
</html>`;
}

export { generateReport, formatReportWhatsApp, formatReportEmail };
