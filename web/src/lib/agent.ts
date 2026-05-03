import Anthropic from '@anthropic-ai/sdk';
import * as db from './db';

const anthropic = new Anthropic();
const locks = new Map<string, Promise<void>>();

type Stage = 'greeting' | 'gathering' | 'confirming' | 'done' | 'awaiting_feedback' | 'awaiting_slot' | 'meeting_scheduled';

function buildSystemPrompt(stage: string, context: Record<string, unknown>): string {
  const persona = `Sos el asistente comercial de David Taranto, desarrollador freelance de Salta, Argentina. David crea soluciones digitales a medida: páginas web, sistemas de gestión, tiendas online, automatizaciones, apps — lo que el negocio necesite.

QUIÉN SOS:
Sos un asesor digital que trabaja junto a David. Nunca decís "soy una IA", "soy un bot" ni nada parecido. Hablás como una persona real del equipo.

TU ROL ESTRATÉGICO:
No sos solo alguien que toma pedidos. Tu función es identificar con precisión qué busca el cliente, incluso cuando no lo exprese de forma completa o clara.

CÓMO HABLÁS:
- Tono profesional pero cercano. Formal sin ser frío.
- Español argentino natural: "vos", "dale", "perfecto"
- Mensajes concretos. Máximo 4-5 líneas por mensaje
- Sin listas numeradas. Conversación fluida
- Un solo emoji si viene al caso, nunca al principio
- Nunca repetís lo que el cliente ya te dijo

LO QUE OFRECE DAVID:
- Páginas web, e-commerce, sistemas de gestión, automatizaciones, apps móviles, chatbots, todo desde cero o mejorando lo existente

REGLAS DE ORO:
1. UNA sola pregunta por mensaje
2. Antes de avanzar, asegurate de haber entendido el tema actual
3. Si detectás necesidad implícita, mencionala naturalmente
4. Cuando no entiendas algo, reformulá la pregunta`;

  const contextInfo = context && Object.keys(context).length > 0
    ? `\nINFO YA CONOCIDA DEL CLIENTE: ${JSON.stringify(context)}\nUsá esto para no preguntar de nuevo lo que ya sabés.`
    : '';

  const phases: Record<Stage, string> = {
    greeting: `FASE: PRIMER CONTACTO
Saludá de forma profesional y cálida. Presentate como parte del equipo de David.
Preguntá el nombre si no lo tenés, y en qué podés ayudar.`,
    gathering: `FASE: DESCUBRIR LA NECESIDAD REAL
Tu objetivo es entender a fondo qué necesita el cliente.
PREGUNTAS (UNA por mensaje, en orden natural): nombre → contexto del negocio → dolor principal → situación actual → expectativas → urgencia → presupuesto (con tacto) → contacto.

CUÁNDO USAR [RESUMEN_LISTO]:
Cuando tengas info esencial (nombre + necesidad clara + contacto), agregá [RESUMEN_LISTO] al final.`,
    confirming: `FASE: CONFIRMAR RESUMEN
Le mostraste un resumen al cliente. Esperás respuesta.
- Si confirma → poné al final: [CONFIRMADO]
- Si quiere cambiar algo → ajustá y mostrá resumen actualizado`,
    done: `FASE: PROPUESTA EN PREPARACIÓN
El cliente ya confirmó. Se está preparando la propuesta.
- Si quieren agregar/cambiar algo → poné al final: [MODIFICACION]`,
    awaiting_feedback: `FASE: ESPERANDO FEEDBACK SOBRE LA PROPUESTA
El cliente recibió la propuesta visual.
- INTERESADO → "El siguiente paso sería una videollamada con David, 45 minutos." Al final: [AGENDAR_REUNION]
- TIENE DUDAS → respondé con seguridad, explicá el valor
- QUIERE CAMBIOS → al final: [QUIERE_CAMBIAR]
- PIDE TIEMPO → "Por supuesto, cualquier duda estoy por acá"`,
    awaiting_slot: `FASE: ELIGIENDO HORARIO
Le mostraste 3 opciones de horario.
- Primera opción → [SLOT_1]
- Segunda → [SLOT_2]
- Tercera → [SLOT_3]
- Si ninguno sirve → preguntale qué día/horario`,
    meeting_scheduled: `FASE: REUNIÓN AGENDADA
Ya hay reunión agendada. El cliente está a un paso de arrancar.
Mantené el tono profesional y entusiasta.`,
  };

  return `${persona}${contextInfo}\n\n${phases[stage as Stage] || phases.gathering}`;
}

async function generateClientSummary(history: Array<{ role: string; content: string }>): Promise<string> {
  const conversationText = history
    .map(m => `${m.role === 'user' ? 'Cliente' : 'Asistente'}: ${m.content}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `Leé esta conversación y armá un resumen claro y profesional para confirmar con el cliente.
Hablá en español argentino con "vos", tono profesional pero cercano.
Empezá con "Perfecto, te hago un resumen de lo que hablamos —".
Mencioná el nombre del cliente. 3-4 oraciones explicando qué necesita y detalles clave.
Terminá con: "¿Está todo correcto o querés ajustar algo?"
Sin viñetas, sin asteriscos, todo en oraciones naturales.`,
    messages: [{ role: 'user', content: conversationText }],
  });

  const block = response.content[0];
  return block.type === 'text' ? block.text : '';
}

function trimHistory(history: Array<{ role: string; content: string }>, keepLast = 20) {
  if (history.length <= keepLast + 2) return history;
  const tail = history.slice(-keepLast);
  if (tail.length > 0 && tail[0].role !== 'user') tail.shift();
  return [...history.slice(0, 2), ...tail];
}

export interface AgentResult {
  reply: string;
  stage: string;
  previousStage: string;
  report: db.ConversationReport | null;
  needsCalendarSlots: boolean;
  selectedSlotIndex: number | null;
  wantsChanges: boolean;
}

export async function handleMessage(phone: string, userText: string): Promise<AgentResult> {
  while (locks.has(phone)) await locks.get(phone);

  let resolveLock!: () => void;
  const promise = new Promise<void>(r => { resolveLock = r; });
  locks.set(phone, promise);

  try {
    let conv = await db.getConversation(phone);
    const stage = conv?.stage || 'greeting';
    const context = conv?.context || {};
    const report = conv?.report || null;
    const history = conv?.history || [];

    history.push({ role: 'user', content: userText });

    const systemPrompt = buildSystemPrompt(stage, context);
    const trimmed = trimHistory(history);

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: trimmed.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    });

    const block = response.content[0];
    let reply = block.type === 'text' ? block.text : '';
    let newStage = stage;
    let needsCalendarSlots = false;
    let selectedSlotIndex: number | null = null;
    let wantsChanges = false;

    if (reply.includes('[RESUMEN_LISTO]')) {
      reply = reply.replace(/\s*\[RESUMEN_LISTO\]\s*/g, '').trim();
      newStage = 'confirming';
      try {
        const summary = await generateClientSummary([...history, { role: 'assistant', content: reply }]);
        reply = reply ? `${reply}\n\n${summary}` : summary;
      } catch (err) {
        console.error('[agent] summary error:', (err as Error).message);
      }
    }

    if (reply.includes('[CONFIRMADO]')) {
      reply = reply.replace(/\s*\[CONFIRMADO\]\s*/g, '').trim();
      newStage = 'done';
    }
    if (reply.includes('[MODIFICACION]')) {
      reply = reply.replace(/\s*\[MODIFICACION\]\s*/g, '').trim();
    }
    if (reply.includes('[AGENDAR_REUNION]')) {
      reply = reply.replace(/\s*\[AGENDAR_REUNION\]\s*/g, '').trim();
      newStage = 'awaiting_slot';
      needsCalendarSlots = true;
    }
    if (reply.includes('[QUIERE_CAMBIAR]')) {
      reply = reply.replace(/\s*\[QUIERE_CAMBIAR\]\s*/g, '').trim();
      wantsChanges = true;
    }
    if (reply.includes('[SLOT_1]')) {
      reply = reply.replace(/\s*\[SLOT_1\]\s*/g, '').trim();
      newStage = 'meeting_scheduled'; selectedSlotIndex = 0;
    } else if (reply.includes('[SLOT_2]')) {
      reply = reply.replace(/\s*\[SLOT_2\]\s*/g, '').trim();
      newStage = 'meeting_scheduled'; selectedSlotIndex = 1;
    } else if (reply.includes('[SLOT_3]')) {
      reply = reply.replace(/\s*\[SLOT_3\]\s*/g, '').trim();
      newStage = 'meeting_scheduled'; selectedSlotIndex = 2;
    }

    history.push({ role: 'assistant', content: reply });

    if (stage === 'greeting' && newStage === 'greeting') {
      newStage = 'gathering';
    }

    await db.upsertConversation(phone, { history, stage: newStage, context, report });

    return {
      reply, stage: newStage, previousStage: stage, report,
      needsCalendarSlots, selectedSlotIndex, wantsChanges,
    };
  } finally {
    locks.delete(phone);
    resolveLock();
  }
}
