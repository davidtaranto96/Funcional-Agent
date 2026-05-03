import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAdminToken } from '@/lib/session';

export async function POST(req: NextRequest) {
  const auth = requireAdminToken(req);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const body = await req.json();
  const phone = String(body?.phone || '');
  if (!phone) return NextResponse.json({ error: 'Se requiere phone' }, { status: 400 });

  const normalizedPhone = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
  await db.upsertConversation(normalizedPhone, {
    history: [],
    stage: 'greeting',
    context: {},
    report: null,
  });

  return NextResponse.json({ ok: true, phone: normalizedPhone, message: 'Conversación reiniciada' });
}
