import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';

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

  if (formData) {
    const referer = req.headers.get('referer');
    const target = referer ? new URL(referer) : publicUrl(req, '/admin/control');
    return NextResponse.redirect(target, { status: 303 });
  }
  return NextResponse.json({ ok: true });
}
