import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { getFile, deleteFile, ProxyError } from '@/lib/file-proxy';

export const runtime = 'nodejs';

// GET: download / inline preview — proxia el binary del Funcional-Agent
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; name: string }> }) {
  try {
    await requireAuth();
    const { id, name } = await ctx.params;
    const decoded = decodeURIComponent(name);
    const result = await getFile(id, decoded);
    return new NextResponse(result.buffer, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        ...(result.disposition ? { 'Content-Disposition': result.disposition } : {}),
      },
    });
  } catch (err) {
    if (err instanceof ProxyError && err.status === 404) return new NextResponse('Not found', { status: 404 });
    return new NextResponse('Error', { status: 500 });
  }
}

// POST: borrar archivo. Ahora devuelve JSON (no redirect) para que el cliente
// vea errores reales en vez de un falso 303 que escondia fallos.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; name: string }> }) {
  try {
    await requireAuth();
    const { id, name } = await ctx.params;
    const decoded = decodeURIComponent(name);
    const formData = await req.formData().catch(() => null);
    const action = String(formData?.get('action') || 'delete');
    if (action !== 'delete') {
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    }
    await deleteFile(id, decoded);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ProxyError) {
      console.error('[file/delete] proxy error:', err.message, err.body);
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const e = err as Error;
    console.error('[file/delete]', e);
    return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
  }
}
