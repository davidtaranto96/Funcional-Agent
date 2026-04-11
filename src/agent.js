const Anthropic = require('@anthropic-ai/sdk');
const db = require('./db');

const anthropic = new Anthropic();

// Lock por teléfono para evitar race conditions con mensajes rápidos
const locks = new Map();

function buildSystemPrompt(stage, context) {
  const persona = `Sos el asistente de David Taranto, desarrollador freelance de Salta, Argentina. David crea soluciones digitales a medida: páginas web, sistemas de gestión, tiendas online, automatizaciones, apps, lo que el negocio necesite.

QUIÉN SOS:
Sos como un ayudante personal de David, no un robot. Te llamás como David te haya puesto, pero nunca decís "soy una IA" ni nada parecido. Sos una persona que trabaja con David y atiende sus consultas.

CÓMO HABLÁS:
- Español rioplatense natural: "vos", "che", "dale", "buenísimo", "re", "igual", "obvio" — como habla cualquier argentino en un chat
- Mensajes cortos, como WhatsApp real. Máximo 3-4 líneas por mensaje. Si tenés mucho para decir, partilo en mensajes
- Sin listas numeradas ni puntos. Conversación fluida, no formulario
- Un solo emoji si viene al caso, nunca al principio del mensaje
- Si el cliente escribe corto y simple, respondés igual de simple
- Nunca repetís lo que el cliente ya te dijo
- Si no entendés algo, preguntás de otra forma, no hacés drama

LO QUE OFRECE DAVID — para que puedas orientar sin preguntar todo:
- Páginas web (presentación, portfolio, negocio local)
- Tiendas online / e-commerce
- Sistemas de gestión (stock, turnos, pedidos, facturación, clientes)
- Automatizaciones (WhatsApp automático, emails, reportes, integraciones entre apps)
- Apps móviles o web a medida
- Todo desde cero o mejorando lo que ya tienen

Si el cliente no sabe bien qué quiere, ayudalo a entender qué problema tiene y qué podría solucionarlo. No asumas que saben de tecnología.`;

  const contextInfo = context && Object.keys(context).length > 0
    ? `\nINFO YA CONOCIDA DEL CLIENTE: ${JSON.stringify(context)}\nUsá esto para no preguntar de nuevo lo que ya sabés.`
    : '';

  const phases = {
    greeting: `FASE: PRIMER CONTACTO
Saludá de manera natural y presentate brevemente como el ayudante de David. No suenes corporativo.
Preguntá el nombre si no lo tenés, y qué los trae por acá.
Si ya dicen de entrada qué necesitan, primero preguntá el nombre y después seguís con eso.
Ejemplos de apertura: "Hola! Soy el asistente de David, contame ¿en qué te puedo ayudar?" o "Buenas! ¿Con quién tengo el gusto?"`,

    gathering: `FASE: ENTENDER QUÉ NECESITA
Tu objetivo es entender bien el problema o necesidad del cliente para que David pueda armar una propuesta a medida.

Guiá la conversación para conocer:
1. Nombre del cliente (si no lo tenés)
2. Qué problema quiere resolver o qué quiere lograr (preguntá en términos del negocio, no técnicos)
3. Qué tiene hoy: ¿ya tiene algo hecho, usa algún sistema, o empieza de cero?
4. Cuánta urgencia tiene o para cuándo lo necesitaría
5. Si tiene idea del presupuesto (no presiones, si no quiere decir está bien)
6. Un email o WhatsApp para mandarle la propuesta

CÓMO GUIAR A ALGUIEN QUE NO SABE DE TECNOLOGÍA:
- Preguntá por el negocio: "¿A qué te dedicás?" / "¿Cómo manejás hoy los pedidos/clientes/stock?"
- Preguntá por el dolor: "¿Qué es lo que más te complica en el día a día?"
- Sugerí opciones concretas si el cliente no sabe cómo llamar a lo que necesita
- Ejemplo: si dice "quiero algo para que mis clientes me contacten más fácil" → podría ser una web, un bot de WhatsApp, o ambos

UNA sola pregunta por mensaje. Nunca interrogues con varios puntos seguidos.

REGLA CRÍTICA — CUÁNDO USAR [RESUMEN_LISTO]:
Cuando tengas la info básica (nombre + necesidad + contacto), OBLIGATORIAMENTE agregá [RESUMEN_LISTO] al final de tu respuesta.
NO esperes tener todos los detalles perfectos. NO digas "David te va a contactar" sin usar la marca.
NO cierres la conversación sin [RESUMEN_LISTO]. Si el cliente ya dió su contacto y explicó su necesidad, es el momento.
Ejemplo correcto: "Perfecto, ya tengo todo lo que necesita David. [RESUMEN_LISTO]"`,

    confirming: `FASE: CONFIRMAR RESUMEN
Le mostraste al cliente un resumen de lo que charlaron. Ahora esperás su respuesta.
- Si confirma que está bien (dice "sí", "dale", "correcto", "perfecto", o similar) → poné al final: [CONFIRMADO]
- Si quiere cambiar algo → ajustá y mostrá el resumen actualizado, esperá otra confirmación
- No agregues [CONFIRMADO] hasta que el cliente lo confirme explícitamente

Cuando confirmen, algo como: "Buenísimo, ya le mando todo a David. En un rato te llega una propuesta visual por acá mismo, fijate el WhatsApp en unos minutos"`,

    done: `FASE: CERRADO
El cliente ya confirmó y David recibió toda la info. Se está preparando la propuesta.
- Si preguntan cuándo los contacta David → "en breve, y también te va a llegar una propuesta visual por WhatsApp en unos minutos"
- Si quieren agregar o cambiar algo → anotalo amablemente, poné al final: [MODIFICACION]
- Si preguntan qué sigue → "te mando una propuesta visual acá por WhatsApp, y después David te contacta para afinar los detalles y arrancar"
- Si solo agradecen o se van → respondé breve y amable`,

    awaiting_feedback: `FASE: ESPERANDO FEEDBACK DEL CLIENTE SOBRE SU PROPUESTA
El cliente acaba de recibir su propuesta visual personalizada (una landing, un mockup y un PDF).
Tu objetivo: entender si quiere arrancar o si tiene dudas.
- Respondé de forma natural y entusiasta, como alguien que acaba de mostrar algo que armó con cuidado
- Si el cliente muestra interés, dice que le copa, que sí, que quiere arrancar, que cuándo empezamos → poné al final: [AGENDAR_REUNION]
- Si el cliente dice que quiere cambiar algo, que no le convence alguna parte, que tiene dudas sobre el precio o el alcance → poné al final: [QUIERE_CAMBIAR] y anotá qué quiere cambiar
- Si hace preguntas sobre la propuesta → respondelas con entusiasmo y esperá su decisión
- El siguiente paso natural es una llamada corta de 45 minutos con David para afinar detalles y arrancar`,

    awaiting_slot: `FASE: ELIGIENDO HORARIO DE REUNIÓN
Le mostraste al cliente 3 opciones de horario para una videollamada con David. Está eligiendo cuál le queda bien.
- Si dice "el primero", "el 1", "el de más temprano", "el de la mañana", "lunes" o similar → confirmá amable y poné: [SLOT_1]
- Si dice "el segundo", "el 2", "el del medio", "la tarde" o hace referencia a la segunda opción → confirmá y poné: [SLOT_2]
- Si dice "el tercero", "el 3", "el último", "el más tarde" → confirmá y poné: [SLOT_3]
- Si ninguno le viene → preguntale qué día/hora les quedaría mejor y deciles que David les va a confirmar un horario
- Respondé brevemente ("¡Perfecto!" / "¡Dale, el segundo entonces!") y poné el marcador del slot elegido`,

    meeting_scheduled: `FASE: REUNIÓN AGENDADA
Ya hay una reunión agendada con David. El cliente está a un paso de arrancar.
- Si preguntan sobre la reunión → confirmá que está agendada y que el link de videollamada ya les debería haber llegado
- Si quieren saber qué sigue → "en la reunión David te cuenta el plan completo y arrancamos"
- Si quieren cambiar el horario → deciles que le avisen directamente a David
- Mantené el tono entusiasmado, esto está por arrancar`,
  };

  return `${persona}${contextInfo}\n\n${phases[stage]}`;
}

// Genera un resumen casual del proyecto para mostrar al cliente
async function generateClientSummary(history) {
  const conversationText = history
    .map(m => `${m.role === 'user' ? 'Cliente' : 'Asistente'}: ${m.content}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `Leé esta conversación y armá un resumen bien humano y casual para confirmar con el cliente.
Hablá en español rioplatense, con "vos". Sin listas numeradas ni viñetas — todo en oraciones naturales como en un chat.
Empezá con algo como "A ver si lo entendí bien —" o "Dale, te cuento lo que me quedó —" o "Bueno, para estar seguros —".
Mencioná el nombre del cliente si lo sabés. Explicá en 2-3 oraciones qué necesita, para cuándo y cualquier detalle importante.
Terminá con algo como "¿Está todo bien así o querés cambiar algo?" — natural, no formal.
MUY IMPORTANTE: el resumen tiene que sonar como lo escribió una persona, no un sistema. Sin "Punto 1:", sin asteriscos, sin formato raro.`,
    messages: [{ role: 'user', content: conversationText }],
  });

  return response.content[0].text;
}

// Ventana deslizante: primeros 2 mensajes + últimos N para controlar costos
function trimHistory(history, keepLast = 20) {
  if (history.length <= keepLast + 2) return history;
  const tail = history.slice(-keepLast);
  // Ensure the tail starts with a 'user' message to maintain alternating roles
  if (tail.length > 0 && tail[0].role !== 'user') {
    tail.shift();
  }
  return [...history.slice(0, 2), ...tail];
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
    let conv = await db.getConversation(phone);
    if (!conv) {
      conv = { history: [], stage: 'greeting', context: {}, report: null };
    }

    const history = conv.history;
    history.push({ role: 'user', content: userText });

    const systemPrompt = buildSystemPrompt(conv.stage, conv.context);
    const trimmed = trimHistory(history);

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: trimmed,
    });

    let reply = response.content[0].text;
    let newStage = conv.stage;
    let report = conv.report;

    // Flags para index.js
    let needsCalendarSlots = false;
    let selectedSlotIndex = null;
    let wantsChanges = false;

    // Detectar marcas de transición de fase
    if (reply.includes('[RESUMEN_LISTO]')) {
      reply = reply.replace(/\s*\[RESUMEN_LISTO\]\s*/g, '').trim();
      newStage = 'confirming';

      // Generar resumen casual para el cliente
      try {
        const summary = await generateClientSummary([...history, { role: 'assistant', content: reply }]);
        reply = reply ? `${reply}\n\n${summary}` : summary;
      } catch (err) {
        console.error('[agent] Error generating summary:', err.message);
      }
    }

    if (reply.includes('[CONFIRMADO]')) {
      reply = reply.replace(/\s*\[CONFIRMADO\]\s*/g, '').trim();
      newStage = 'done';
    }

    if (reply.includes('[MODIFICACION]')) {
      reply = reply.replace(/\s*\[MODIFICACION\]\s*/g, '').trim();
      // Se queda en done, pero marca que hay modificación
    }

    // ── Marcadores del flujo de reunión ──────────────────────────────────────
    if (reply.includes('[AGENDAR_REUNION]')) {
      reply = reply.replace(/\s*\[AGENDAR_REUNION\]\s*/g, '').trim();
      newStage = 'awaiting_slot';
      needsCalendarSlots = true;
    }

    if (reply.includes('[QUIERE_CAMBIAR]')) {
      reply = reply.replace(/\s*\[QUIERE_CAMBIAR\]\s*/g, '').trim();
      // Se queda en awaiting_feedback
      wantsChanges = true;
    }

    if (reply.includes('[SLOT_1]')) {
      reply = reply.replace(/\s*\[SLOT_1\]\s*/g, '').trim();
      newStage = 'meeting_scheduled';
      selectedSlotIndex = 0;
    } else if (reply.includes('[SLOT_2]')) {
      reply = reply.replace(/\s*\[SLOT_2\]\s*/g, '').trim();
      newStage = 'meeting_scheduled';
      selectedSlotIndex = 1;
    } else if (reply.includes('[SLOT_3]')) {
      reply = reply.replace(/\s*\[SLOT_3\]\s*/g, '').trim();
      newStage = 'meeting_scheduled';
      selectedSlotIndex = 2;
    }
    // ─────────────────────────────────────────────────────────────────────────

    history.push({ role: 'assistant', content: reply });

    // Después del greeting, pasar a gathering automáticamente
    if (conv.stage === 'greeting' && newStage === 'greeting') {
      newStage = 'gathering';
    }

    await db.upsertConversation(phone, {
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
      needsCalendarSlots,
      selectedSlotIndex,
      wantsChanges,
    };
  } finally {
    locks.delete(phone);
    resolve();
  }
}

module.exports = { handleMessage };
