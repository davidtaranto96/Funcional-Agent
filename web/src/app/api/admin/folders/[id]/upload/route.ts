import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';
import { resolveFolder, sanitizeFilename, uniqueName } from '@/lib/document-folders';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;
  const folder = await resolveFolder(id);
  if (!folder) return NextResponse.json({ error: 'folder not found' }, { status: 404 });
  fs.mkdirSync(folder.dir, { recursive: true });
  const formData = await req.formData();
  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  let saved = 0;
  for (const file of files) {
    if (file.size > 50 * 1024 * 1024) continue;
    const filename = uniqueName(folder.dir, sanitizeFilename(file.name));
    const fullPath = path.join(folder.dir, filename);
    if (!fullPath.startsWith(folder.dir)) continue;
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(fullPath, buf);
    saved++;
  }
  return NextResponse.redirect(publicUrl(req, `/admin/documentos/${id}?uploaded=${saved}`), { status: 303 });
}
