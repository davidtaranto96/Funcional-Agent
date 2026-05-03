import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;
  const formData = await req.formData().catch(() => null);
  const json = formData ? null : await req.json().catch(() => null);
  const action = String(formData?.get('action') || json?.action || 'read');

  if (action === 'delete') await db.deleteNotification(id);
  else await db.markNotificationRead(id);

  if (formData) {
    const referer = req.headers.get('referer');
    const target = referer ? new URL(referer) : publicUrl(req, '/admin/control');
    return NextResponse.redirect(target, { status: 303 });
  }
  return NextResponse.json({ ok: true });
}
