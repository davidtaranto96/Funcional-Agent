import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;
  // Solo borramos custom folders (df_*). Las pf_* y wd_* son virtuales —
  // sus archivos viven en data/project-files o data/demos respectivamente.
  if (id.startsWith('pf_') || id.startsWith('wd_')) {
    return NextResponse.redirect(publicUrl(req, '/admin/documentos'), { status: 303 });
  }
  await db.deleteDocumentFolder(id);
  return NextResponse.redirect(publicUrl(req, '/admin/documentos'), { status: 303 });
}
