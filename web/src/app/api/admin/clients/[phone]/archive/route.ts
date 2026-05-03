import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';

export async function POST(req: NextRequest, ctx: { params: Promise<{ phone: string }> }) {
  await requireAuth();
  const { phone } = await ctx.params;
  const decoded = decodeURIComponent(phone);
  const formData = await req.formData().catch(() => null);
  const json = formData ? null : await req.json().catch(() => null);
  const action = String(formData?.get('action') || json?.action || 'archive');

  if (action === 'unarchive') {
    await db.unarchiveConversation(decoded);
  } else {
    await db.archiveConversation(decoded);
  }

  if (formData) {
    return NextResponse.redirect(publicUrl(req, '/admin/clients'), { status: 303 });
  }
  return NextResponse.json({ ok: true });
}
