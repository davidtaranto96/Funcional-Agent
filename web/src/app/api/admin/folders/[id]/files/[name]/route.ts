import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';
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

// POST con action=delete: borrar archivo
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; name: string }> }) {
  await requireAuth();
  const { id, name } = await ctx.params;
  const decoded = decodeURIComponent(name);
  const formData = await req.formData().catch(() => null);
  const action = String(formData?.get('action') || 'delete');
  if (action === 'delete') {
    try { await deleteFile(id, decoded); } catch (err) { console.error('[file/delete]', (err as Error).message); }
  }
  return NextResponse.redirect(publicUrl(req, `/admin/documentos/${id}`), { status: 303 });
}
