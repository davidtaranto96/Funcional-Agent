import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/clients/[phone]/toggle-bot
// Body opcional: { paused: boolean } — si no viene, toggle.
export async function POST(req: NextRequest, ctx: { params: Promise<{ phone: string }> }) {
  await requireAuth();
  const { phone } = await ctx.params;
  const decoded = decodeURIComponent(phone);

  const conv = await db.getConversation(decoded);
  if (!conv) return NextResponse.json({ error: 'cliente no encontrado' }, { status: 404 });

  let nextPaused: boolean;
  try {
    const body = await req.json().catch(() => ({} as { paused?: boolean }));
    nextPaused = typeof body.paused === 'boolean' ? body.paused : conv.bot_paused !== 1;
  } catch {
    nextPaused = conv.bot_paused !== 1;
  }

  await db.setBotPaused(decoded, nextPaused);
  await db.appendTimelineEvent(decoded, {
    event: nextPaused ? 'bot_paused' : 'bot_resumed',
    note: nextPaused ? 'David tomó la conversación manualmente' : 'David devolvió la conversación al bot',
  });

  return NextResponse.json({ ok: true, paused: nextPaused });
}
