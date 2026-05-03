import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { sendApprovedDemoToClient } from '@/lib/orchestrator';
import { requireAuth } from '@/lib/session';

export async function POST(req: NextRequest, ctx: { params: Promise<{ phone: string }> }) {
  await requireAuth();
  const { phone } = await ctx.params;
  const decoded = decodeURIComponent(phone);
  await db.updateDemoStatus(decoded, 'approved');
  await db.appendTimelineEvent(decoded, { event: 'demo_approved', note: 'Aprobado desde el panel' });
  sendApprovedDemoToClient(decoded).catch(console.error);
  return NextResponse.redirect(new URL(`/admin/client/${phone}`, req.url), { status: 303 });
}
