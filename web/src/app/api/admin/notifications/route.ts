import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

// POST: bulk actions (mark all read, delete read, delete all)
export async function POST(req: NextRequest) {
  await requireAuth();
  const formData = await req.formData().catch(() => null);
  const json = formData ? null : await req.json().catch(() => null);
  const action = String(formData?.get('action') || json?.action || '');

  if (action === 'read-all') await db.markAllNotificationsRead();
  else if (action === 'delete-read') await db.deleteReadNotifications();
  else if (action === 'delete-all') await db.deleteAllNotifications();
  else return NextResponse.json({ error: 'unknown action' }, { status: 400 });

  if (formData) return NextResponse.redirect(new URL(req.headers.get('referer') || '/admin/control', req.url), { status: 303 });
  return NextResponse.json({ ok: true });
}
