import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { moveFile, ProxyError } from '@/lib/file-proxy';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; name: string }> }) {
  try {
    await requireAuth();
    const { id, name } = await ctx.params;
    const formData = await req.formData();
    const toFolder = String(formData.get('toFolder') || '').trim();
    if (!toFolder) return NextResponse.json({ error: 'Carpeta destino faltante' }, { status: 400 });
    const result = await moveFile(id, decodeURIComponent(name), toFolder);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ProxyError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
