import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { scoreConversation } from '@/lib/bot/scoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ phone: string }> }) {
  await requireAuth();
  const { phone } = await ctx.params;
  const decoded = decodeURIComponent(phone);

  try {
    const result = await scoreConversation(decoded);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message || 'error scoring' }, { status: 500 });
  }
}
