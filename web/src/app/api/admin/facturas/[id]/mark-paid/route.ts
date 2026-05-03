import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const method = String(body?.method || '');
  await db.markInvoicePaid(id, method);
  return NextResponse.json({ ok: true });
}
