import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';

export async function POST(req: NextRequest, ctx: { params: Promise<{ phone: string }> }) {
  await requireAuth();
  const { phone } = await ctx.params;
  const formData = await req.formData().catch(() => null);
  const json = formData ? null : await req.json().catch(() => null);
  const stage = String(formData?.get('stage') || json?.stage || '');
  if (!stage) return NextResponse.json({ error: 'stage required' }, { status: 400 });

  await db.updateClientStage(decodeURIComponent(phone), stage);
  await db.appendTimelineEvent(decodeURIComponent(phone), { event: 'stage_changed', note: `→ ${stage}` });

  if (formData) return NextResponse.redirect(publicUrl(req, `/admin/client/${phone}`), { status: 303 });
  return NextResponse.json({ ok: true });
}
