import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/clients/[phone]/nickname
// Body: { nickname: string }  (vacio borra el alias)
export async function POST(req: NextRequest, ctx: { params: Promise<{ phone: string }> }) {
  await requireAuth();
  const { phone } = await ctx.params;
  const decoded = decodeURIComponent(phone);

  let nickname: string;
  try {
    const body = await req.json();
    nickname = String(body.nickname || '').trim();
  } catch {
    return NextResponse.json({ error: 'body invalido' }, { status: 400 });
  }

  const conv = await db.getConversation(decoded);
  if (!conv) return NextResponse.json({ error: 'cliente no encontrado' }, { status: 404 });

  await db.setNickname(decoded, nickname);
  return NextResponse.json({ ok: true, nickname });
}
