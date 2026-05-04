import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Costs: claude-sonnet-4-6 ~$3/MTok input, $15/MTok output. Una conversacion
// tipica de 30 mensajes son ~3K tokens input, analisis ~1.5K output → ~$0.03
// por analisis. Cacheable si lo corres varias veces sobre la misma conv.
const MODEL = 'claude-sonnet-4-6';

const ANALYSIS_SYSTEM = `Sos un coach de ventas y experto en prompt engineering revisando una conversación entre un asistente comercial (bot WhatsApp) y un cliente potencial.

El bot trabaja para David Taranto, freelance dev de Salta. Su trabajo es:
- Detectar la necesidad real del cliente (incluso cuando es vaga)
- Hacer UNA pregunta por mensaje
- Sugerir necesidades implícitas
- Llegar a un resumen confirmado y agendar siguiente paso con David

Tu trabajo es analizar la conversación y devolver un JSON estructurado con feedback para mejorar al bot. Sé crítico pero específico — cada observación tiene que apuntar a un mensaje concreto o a una regla del prompt que mejorar.

Devolvé SOLO un JSON valido (sin markdown fences, sin texto extra) con este shape exacto:

{
  "score": number,           // 0-10 calidad general de la conversacion
  "summary": string,         // 2-3 oraciones — que paso, como termino
  "strengths": string[],     // 2-5 cosas que salieron bien (especificas)
  "weaknesses": string[],    // 2-5 cosas que se pudieron hacer mejor (especificas)
  "missedOpportunities": string[],  // info que el bot no consiguio o no profundizo
  "specificMoments": [       // momentos puntuales del chat para revisar
    {
      "messageIdx": number,  // index 0-based en el history
      "role": "user" | "assistant",
      "issue": string,       // que paso ahi
      "suggestion": string   // como deberia haber respondido
    }
  ],
  "promptSuggestions": [     // cambios concretos al system prompt
    {
      "issue": string,       // que regla falto o fallo
      "suggestion": string,  // texto exacto a agregar/cambiar al prompt
      "priority": "high" | "medium" | "low"
    }
  ]
}

Reglas:
- Si la conversacion fue corta (<5 mensajes) marcalo en summary y bajá score
- Si el bot rompio la regla "una pregunta por mensaje" señalalo en specificMoments
- Si el bot llego a [RESUMEN_LISTO] sin info esencial (presupuesto, plataforma, urgencia), señalalo
- En promptSuggestions, escribi el texto LITERAL que deberia agregarse/modificarse al system prompt, no descripciones genericas
- No inventes momentos: cada specificMoments.messageIdx tiene que existir en el history`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ phone: string }> }) {
  await requireAuth();
  const { phone } = await ctx.params;
  const decoded = decodeURIComponent(phone);

  const conv = await db.getConversation(decoded);
  if (!conv) return NextResponse.json({ error: 'cliente no encontrado' }, { status: 404 });

  const history: ChatMessage[] = (conv.history || []).filter(
    (m): m is ChatMessage => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
  );

  if (history.length === 0) {
    return NextResponse.json({ error: 'sin historial de conversacion' }, { status: 400 });
  }

  // Formato la conversacion como texto plano numerado para que el modelo
  // pueda referenciar messageIdx exactos.
  const conversationText = history
    .map((m, i) => `[${i}] ${m.role === 'user' ? 'CLIENTE' : 'ASISTENTE'}: ${m.content}`)
    .join('\n\n');

  const userPrompt = `Conversacion completa (${history.length} mensajes):

${conversationText}

Analizá y devolvé el JSON segun el shape pedido.`;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 });
  }

  const anthropic = new Anthropic();
  let raw: string;
  try {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: ANALYSIS_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const block = resp.content[0];
    if (!block || block.type !== 'text') {
      return NextResponse.json({ error: 'respuesta vacia del modelo' }, { status: 502 });
    }
    raw = block.text.trim();
  } catch (err) {
    const e = err as Error;
    console.error('[analyze]', e);
    return NextResponse.json({ error: e.message || 'error llamando al modelo' }, { status: 502 });
  }

  // El modelo a veces wrappea el JSON en ```json ... ``` aunque le pidas que no.
  let jsonText = raw;
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1].trim();

  try {
    const parsed = JSON.parse(jsonText);
    return NextResponse.json({
      ok: true,
      analysis: parsed,
      meta: {
        messageCount: history.length,
        model: MODEL,
        analyzedAt: new Date().toISOString(),
        clientName: conv.report?.cliente?.nombre || decoded,
      },
    });
  } catch (err) {
    console.error('[analyze] JSON parse failed. Raw:', raw.slice(0, 500));
    return NextResponse.json({
      error: 'el modelo no devolvio JSON valido',
      raw: raw.slice(0, 1000),
    }, { status: 502 });
  }
}
