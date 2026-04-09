const Anthropic = require('@anthropic-ai/sdk');
const db = require('./db');

const anthropic = new Anthropic();

// Lock por teléfono para evitar race conditions con mensajes rápidos
const locks = new Map();

function buildSystemPrompt(stage, context) {
  const persona = `Sos el asistente comercial de David Taranto, un desarrollador freelance de Salta, Argentina que hace desarrollo de software a medida (webs, apps, sistemas, automatizaciones).

REGLAS DE COMUNICACIÓN:
- Hablás en español argentino, con "vos" en vez de "tú"
- Sos amable, cercano y profesional pero relajado — como un colega, no un bot
- NUNCA uses listas numeradas ni viñetas. Hablá en oraciones naturales
- Respuestas cortas, como mensajes de WhatsApp reales (2-4 oraciones máximo)
- Máximo un emoji por mensaje, y solo si viene al caso
- No repitas info que el cliente ya te dio
- Si no entendés algo, pedí que te lo explique de otra forma`;

  const contextInfo = context && Object.keys(context).length > 0
    ? `\nINFO PREVIA DEL CLIENTE: ${JSON.stringify(context)}\nUsá esta info para personalizar el saludo y no preguntar cosas que ya sabés.`
    : '';

  const phases = {
    greeting: `FASE ACTUAL: SALUDO
Presentate brevemente diciendo que venís de parte de David y preguntá en qué podés ayudar.
Si el cliente ya mencionó qué necesita, no repitas el saludo — pasá directo a hacer preguntas sobre el proyecto.`,

    gathering: `FASE ACTUAL: RELEVAMIENTO
Necesitás averiguar sobre el proyecto del cliente:
- Qué tipo de proyecto es (web, app, sistema, automatización, etc.)
- Funcionalidades principales
- Si tiene algo ya hecho o es desde cero
- Plazos o urgencia
- Presupuesto aproximado (si lo quiere mencionar, no presiones)
- Detalles técnicos relevantes

IMPORTANTE: Hacé UNA sola pregunta por mensaje. No interrogues. Sé conversacional.
Cuando sientas que tenés suficiente info para armar un resumen útil para David, agregá al FINAL de tu respuesta (después del mensaje al cliente) exactamente esta marca en una línea nueva: [RESUMEN_LISTO]`,

    confirming: `FASE ACTUAL: CONFIRMACIÓN
Acabás de armar un resumen del proyecto y se lo mostraste al cliente.
Esperá su respuesta:
- Si confirma que está bien → agregá al final: [CONFIRMADO]
- Si pide cambios → ajustá lo que haga falta, mostrá el resumen actualizado y esperá otra confirmación
No agregues la marca hasta que el cliente explícitamente confirme.`,

    done: `FASE ACTUAL: COMPLETADO
El relevamiento se completó y el reporte ya se envió a David.
Si el cliente quiere agregar o modificar algo, tomá nota y agregá al final: [MODIFICACION]
Si solo agradece o se despide, respondé amablemente diciendo que David se va a comunicar pronto.`
  };

  return `${persona}${contextInfo}\n\n${phases[stage]}`;
}

// Genera un resumen casual del proyecto para mostrar al cliente
async function generateClientSummary(history) {
  const conversationText = history
    .map(m => `${m.role === 'user' ? 'Cliente' : 'Asistente'}: ${m.content}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: `Leé esta conversación y armá un resumen casual y breve del proyecto para confirmar con el cliente.
Hablá en argentino, con "vos". Sin listas numeradas. Empezá con algo como "A ver si entendí bien —" o "Dale, te hago un resumen para ver si estamos en la misma —".
Terminá preguntando si está todo bien o si quiere cambiar algo.`,
    messages: [{ role: 'user', content: conversationText }],
  });

  return response.content[0].text;
}

// Ventana deslizante: primeros 2 mensajes + últimos N para controlar costos
function trimHistory(history, keepLast = 20) {
  if (history.length <= keepLast + 2) return history;
  return [...history.slice(0, 2), ...history.slice(-keepLast)];
}

async function handleMessage(phone, userText) {
  // Esperar si hay otro mensaje del mismo número procesándose
  while (locks.has(phone)) {
    await locks.get(phone);
  }

  let resolve;
  const promise = new Promise(r => { resolve = r; });
  locks.set(phone, promise);

  try {
    let conv = db.getConversation(phone);
    if (!conv) {
      conv = { history: [], stage: 'greeting', context: {}, report: null };
    }

    const history = conv.history;
    history.push({ role: 'user', content: userText });

    const systemPrompt = buildSystemPrompt(conv.stage, conv.context);
    const trimmed = trimHistory(history);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: trimmed,
    });

    let reply = response.content[0].text;
    let newStage = conv.stage;
    let report = conv.report;

    // Detectar marcas de transición de fase
    if (reply.includes('[RESUMEN_LISTO]')) {
      reply = reply.replace(/\s*\[RESUMEN_LISTO\]\s*/g, '').trim();
      newStage = 'confirming';

      // Generar resumen casual para el cliente
      const summary = await generateClientSummary([...history, { role: 'assistant', content: reply }]);
      reply = reply ? `${reply}\n\n${summary}` : summary;
    }

    if (reply.includes('[CONFIRMADO]')) {
      reply = reply.replace(/\s*\[CONFIRMADO\]\s*/g, '').trim();
      newStage = 'done';
    }

    if (reply.includes('[MODIFICACION]')) {
      reply = reply.replace(/\s*\[MODIFICACION\]\s*/g, '').trim();
      // Se queda en done, pero marca que hay modificación
    }

    history.push({ role: 'assistant', content: reply });

    // Después del greeting, pasar a gathering automáticamente
    if (conv.stage === 'greeting' && newStage === 'greeting') {
      newStage = 'gathering';
    }

    db.upsertConversation(phone, {
      history,
      stage: newStage,
      context: conv.context,
      report,
    });

    return {
      reply,
      stage: newStage,
      previousStage: conv.stage,
      report,
    };
  } finally {
    locks.delete(phone);
    resolve();
  }
}

module.exports = { handleMessage };
