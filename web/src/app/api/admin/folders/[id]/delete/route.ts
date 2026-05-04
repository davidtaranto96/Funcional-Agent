import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';
import { resolveFolder } from '@/lib/document-folders';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;
  if (id.startsWith('pf_') || id.startsWith('wd_')) {
    return NextResponse.redirect(publicUrl(req, '/admin/documentos'), { status: 303 });
  }
  try {
    const folder = await resolveFolder(id);
    if (folder && fs.existsSync(folder.dir)) {
      try { fs.rmSync(folder.dir, { recursive: true, force: true }); }
      catch (err) { console.error('[folders/delete] disk:', (err as Error).message); }
    }
    await db.deleteDocumentFolder(id);
  } catch (err) {
    console.error('[folders/delete]', (err as Error).message);
  }
  return NextResponse.redirect(publicUrl(req, '/admin/documentos'), { status: 303 });
}
