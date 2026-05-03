import { NextRequest, NextResponse } from 'next/server';
import { sendApprovedDemoToClient } from '@/lib/orchestrator';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';

export async function POST(req: NextRequest, ctx: { params: Promise<{ phone: string }> }) {
  await requireAuth();
  const { phone } = await ctx.params;
  const decoded = decodeURIComponent(phone);
  sendApprovedDemoToClient(decoded).catch(console.error);
  return NextResponse.redirect(publicUrl(req, `/admin/client/${phone}`), { status: 303 });
}
