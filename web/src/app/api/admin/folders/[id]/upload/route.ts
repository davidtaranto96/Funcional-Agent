import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';
import { uploadFiles } from '@/lib/file-proxy';

export const runtime = 'nodejs';

// Variante con redirect (para forms HTML clásicos sin JS)
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;
  const formData = await req.formData();
  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  let saved = 0;
  if (files.length > 0) {
    try {
      const result = await uploadFiles(id, files);
      saved = result.saved;
    } catch (err) {
      console.error('[upload]', (err as Error).message);
    }
  }
  return NextResponse.redirect(publicUrl(req, `/admin/documentos/${id}?uploaded=${saved}`), { status: 303 });
}
