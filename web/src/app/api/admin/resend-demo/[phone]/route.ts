import { NextRequest, NextResponse } from 'next/server';
import { sendApprovedDemoToClient } from '@/lib/orchestrator';
import { requireAuth } from '@/lib/session';

export async function POST(req: NextRequest, ctx: { params: Promise<{ phone: string }> }) {
  await requireAuth();
  const { phone } = await ctx.params;
  const decoded = decodeURIComponent(phone);
  sendApprovedDemoToClient(decoded).catch(console.error);
  return NextResponse.redirect(new URL(`/admin/client/${phone}`, req.url), { status: 303 });
}
