import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/clients/[phone]/send-message
// Body: { text: string }
// Manda un mensaje al cliente via WhatsApp y lo guarda en history.
// Solo para uso desde el admin (David escribiendo manualmente).
export async function POST(req: NextRequest, ctx: { params: Promise<{ phone: string }> }) {
  await requireAuth();
  const { phone } = await ctx.params;
  const decoded = decodeURIComponent(phone);

  let text: string;
  try {
    const body = await req.json();
    text = String(body.text || '').trim();
  } catch {
    return NextResponse.json({ error: 'body invalido' }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: 'text vacio' }, { status: 400 });

  const conv = await db.getConversation(decoded);
  if (!conv) return NextResponse.json({ error: 'cliente no encontrado' }, { status: 404 });

  // Si la key es lid:..., reconstruimos el JID. sendMessage acepta tanto
  // formato whatsapp:+digits como JID raw con @.
  let replyTo: string;
  if (decoded.startsWith('whatsapp:lid:')) {
    const id = decoded.slice('whatsapp:lid:'.length).replace(/[^0-9]/g, '');
    replyTo = `${id}@lid`;
  } else {
    replyTo = decoded;
  }

  // Lazy import del modulo de WA (no queremos que la API route arranque
  // Baileys; el bot ya esta corriendo en instrumentation.ts y sock vive en
  // globalThis para estar accesible desde aca).
  let sendMessage: (to: string, body: string) => Promise<void>;
  try {
    const mod = await import('@/lib/bot/whatsapp');
    sendMessage = mod.sendMessage;
  } catch (err) {
    return NextResponse.json({
      error: 'no pude cargar el modulo de whatsapp',
      detail: (err as Error).message,
    }, { status: 500 });
  }

  try {
    await sendMessage(replyTo, text);
  } catch (err) {
    return NextResponse.json({
      error: 'fallo el envio por WhatsApp',
      detail: (err as Error).message,
      hint: 'Verificá que el bot esté conectado en /admin/whatsapp',
    }, { status: 502 });
  }

  // Guardar en history para que aparezca en la conversacion
  await db.appendManualMessage(decoded, text);
  await db.appendTimelineEvent(decoded, {
    event: 'manual_message_sent',
    note: text.slice(0, 200),
  });

  return NextResponse.json({ ok: true, sent: text });
}
