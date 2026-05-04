import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/session';
import { resolveFolder, sanitizeFilename, uniqueName } from '@/lib/document-folders';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await ctx.params;
    const folder = await resolveFolder(id);
    if (!folder) return NextResponse.json({ error: 'folder not found' }, { status: 404 });

    try {
      fs.mkdirSync(folder.dir, { recursive: true });
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      return NextResponse.json({
        error: `No pude crear el directorio (${e.code || 'unknown'})`,
        path: folder.dir,
        hint: e.code === 'EACCES' ? 'El servicio no tiene permisos sobre el volume.' : undefined,
      }, { status: 500 });
    }

    const formData = await req.formData();
    const files = formData.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0) return NextResponse.json({ saved: 0 });

    let saved = 0;
    const skipped: string[] = [];
    const errors: string[] = [];
    for (const file of files) {
      try {
        if (file.size > 50 * 1024 * 1024) { skipped.push(`${file.name} (>50MB)`); continue; }
        const filename = uniqueName(folder.dir, sanitizeFilename(file.name));
        const fullPath = path.join(folder.dir, filename);
        if (!fullPath.startsWith(folder.dir)) { errors.push(`${file.name} (path traversal)`); continue; }
        const buf = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(fullPath, buf);
        saved++;
      } catch (e) {
        const err = e as NodeJS.ErrnoException;
        errors.push(`${file.name} (${err.code || err.message})`);
      }
    }
    return NextResponse.json({ saved, skipped, errors });
  } catch (err) {
    const e = err as Error;
    console.error('[upload-ajax]', e);
    return NextResponse.json({ error: e.message || 'Error inesperado' }, { status: 500 });
  }
}
