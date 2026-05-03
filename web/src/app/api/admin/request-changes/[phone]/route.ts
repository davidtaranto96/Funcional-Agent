import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function POST(req: NextRequest, ctx: { params: Promise<{ phone: string }> }) {
  await requireAuth();
  const { phone } = await ctx.params;
  const decoded = decodeURIComponent(phone);
  const formData = await req.formData();
  const notes = String(formData.get('notes') || '');

  await db.setDemoNotes(decoded, notes);
  await db.appendTimelineEvent(decoded, { event: 'changes_requested', note: notes });

  return NextResponse.redirect(new URL(`/admin/client/${phone}`, req.url), { status: 303 });
}
