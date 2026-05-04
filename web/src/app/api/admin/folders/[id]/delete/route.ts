import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';
import { deleteFolder } from '@/lib/file-proxy';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;
  // Las virtuales (pf_, wd_) no se borran — sus archivos viven en el proyecto/demo
  if (id.startsWith('pf_') || id.startsWith('wd_')) {
    return NextResponse.redirect(publicUrl(req, '/admin/documentos'), { status: 303 });
  }
  try {
    await deleteFolder(id);
  } catch (err) {
    console.error('[folders/delete]', (err as Error).message);
  }
  return NextResponse.redirect(publicUrl(req, '/admin/documentos'), { status: 303 });
}
