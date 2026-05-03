import { NextRequest, NextResponse } from 'next/server';
import { transcribeBuffer } from '@/lib/transcriber';
import { requireAuth } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  await requireAuth();
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as File | null;
    if (!file) return NextResponse.json({ error: 'No audio file', text: '' });

    if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: 'GROQ_API_KEY not set', text: '' });

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 10 * 1024 * 1024) return NextResponse.json({ error: 'too large', text: '' }, { status: 413 });

    const text = await transcribeBuffer(buf, '.webm');
    return NextResponse.json({ text });
  } catch (err) {
    console.error('[admin-transcribe]', (err as Error).message);
    return NextResponse.json({ error: (err as Error).message, text: '' });
  }
}
