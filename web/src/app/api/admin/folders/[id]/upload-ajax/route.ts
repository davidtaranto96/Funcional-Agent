import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { uploadFiles, ProxyError } from '@/lib/file-proxy';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await ctx.params;
    const formData = await req.formData();
    const files = formData.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0) return NextResponse.json({ saved: 0 });
    const result = await uploadFiles(id, files);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ProxyError) return NextResponse.json({ error: err.message }, { status: err.status });
    const e = err as Error;
    console.error('[upload-ajax]', e);
    return NextResponse.json({ error: e.message || 'Error inesperado' }, { status: 500 });
  }
}
