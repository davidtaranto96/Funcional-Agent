import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;
  const formData = await req.formData().catch(() => null);
  const json = formData ? null : await req.json().catch(() => null);
  const action = String(formData?.get('action') || json?.action || 'read');

  if (action === 'delete') await db.deleteNotification(id);
  else await db.markNotificationRead(id);

  if (formData) return NextResponse.redirect(new URL(req.headers.get('referer') || '/admin/control', req.url), { status: 303 });
  return NextResponse.json({ ok: true });
}
