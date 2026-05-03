import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function GET(_req: Request, ctx: { params: Promise<{ phone: string }> }) {
  await requireAuth();
  const { phone } = await ctx.params;
  const conv = await db.getConversation(decodeURIComponent(phone));
  if (!conv) return NextResponse.json({ history: [], stage: '', messageCount: 0 });
  return NextResponse.json({
    history: conv.history || [],
    stage: conv.stage,
    client_stage: conv.client_stage,
    demo_status: conv.demo_status,
    messageCount: (conv.history || []).length,
    updated_at: conv.updated_at,
  });
}
