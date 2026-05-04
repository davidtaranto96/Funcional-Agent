import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';
import { resolveFolder } from '@/lib/document-folders';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;

  // Las virtuales (pf_, wd_) no se borran desde aca — sus archivos viven
  // en data/project-files o data/demos y representan al proyecto/demo
  if (id.startsWith('pf_') || id.startsWith('wd_')) {
    return NextResponse.redirect(publicUrl(req, '/admin/documentos'), { status: 303 });
  }

  // Custom folder: borrar tanto el registro en DB como los archivos en disk
  try {
    const folder = await resolveFolder(id);
    if (folder && fs.existsSync(folder.dir)) {
      // Best-effort: borrar archivos dentro y el dir mismo. Si falla por
      // permisos (volume not mounted), seguimos igual con el delete del DB.
      try {
        fs.rmSync(folder.dir, { recursive: true, force: true });
      } catch (err) {
        console.error('[folders/delete] No pude borrar files en disk:', (err as Error).message);
      }
    }
    await db.deleteDocumentFolder(id);
  } catch (err) {
    console.error('[folders/delete] Error:', (err as Error).message);
  }

  return NextResponse.redirect(publicUrl(req, '/admin/documentos'), { status: 303 });
}
