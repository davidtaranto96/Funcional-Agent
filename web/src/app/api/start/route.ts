import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { handleMessage } from '@/lib/agent';
import { sendMessage } from '@/lib/whatsapp';
import { requireAdminToken } from '@/lib/session';

export async function POST(req: NextRequest) {
  const auth = requireAdminToken(req);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const body = await req.json();
  const phone = String(body?.phone || '');
  const context = body?.context;
  if (!phone) return NextResponse.json({ error: 'Se requiere phone' }, { status: 400 });

  const normalizedPhone = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;

  if (context) {
    await db.setContext(normalizedPhone, context);
  }

  try {
    const result = await handleMessage(normalizedPhone, '[El cliente fue contactado proactivamente por David]');
    await sendMessage(normalizedPhone, result.reply);
    return NextResponse.json({ ok: true, phone: normalizedPhone, message: result.reply });
  } catch (err) {
    console.error('Error en /start:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
