// @ts-nocheck
// Lead scoring: evalua una conversacion y devuelve hot/warm/cold + razon.
// Usable directamente desde el bot (background) o desde el endpoint API.

import Anthropic from '@anthropic-ai/sdk';
import * as db from '@/lib/db';

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM = `Sos un evaluador de leads para un freelance dev (David Taranto).
Dada una conversación entre un cliente potencial y el bot de David, devolvé un
score:

- hot: cliente con problema claro, presupuesto razonable o flexible, urgencia
  real, decisor identificado, perfil que calza con lo que David hace
- warm: cliente con interés genuino pero falta info clave (presupuesto, plazo
  o claridad del problema). Vale la pena seguirlo manualmente.
- cold: cliente exploratorio sin definición, presupuesto irreal, idea poco
  viable, o que solo está "preguntando" sin compromiso.

Devolvé SOLO un JSON valido (sin markdown, sin texto extra) con shape exacto:
{
  "score": "hot" | "warm" | "cold",
  "reason": string  // 1 oracion breve, en español, explicando POR QUE ese score
}

La razón debe ser concreta y útil para que David decida prioridad. Ejemplos:
- hot: "Pidió MVP en 2 meses con presupuesto razonable y email confirmado."
- warm: "Idea clara pero no mencionó presupuesto ni urgencia."
- cold: "Solo preguntó precios, no definió necesidad ni plazos."`;

export interface ScoreResult {
  score: 'hot' | 'warm' | 'cold';
  reason: string;
}

export async function scoreConversation(phone) {
  const conv = await db.getConversation(phone);
  if (!conv) throw new Error('cliente no encontrado');

  const history = (conv.history || []).filter(m => m && (m.role === 'user' || m.role === 'assistant'));
  if (history.length === 0) throw new Error('sin historial');

  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY no configurada');

  const conversationText = history
    .map(m => `${m.role === 'user' ? 'CLIENTE' : 'ASISTENTE'}: ${m.content}`)
    .join('\n\n');

  const reportSummary = conv.report
    ? `\n\nDATOS EXTRAÍDOS:\n${JSON.stringify({
        cliente: conv.report.cliente,
        proyecto: conv.report.proyecto,
        requisitos: conv.report.requisitos,
      }, null, 2)}`
    : '';

  const userPrompt = `Conversación (${history.length} mensajes):\n\n${conversationText}${reportSummary}\n\nDevolvé el JSON.`;

  const anthropic = new Anthropic();
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const block = resp.content[0];
  if (!block || block.type !== 'text') throw new Error('respuesta vacia del modelo');
  let raw = block.text.trim();

  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();

  const parsed = JSON.parse(raw);
  if (!['hot', 'warm', 'cold'].includes(parsed.score)) {
    throw new Error(`score invalido: ${parsed.score}`);
  }

  await db.setLeadScore(phone, parsed.score, parsed.reason || '');
  return { score: parsed.score, reason: parsed.reason || '' };
}
