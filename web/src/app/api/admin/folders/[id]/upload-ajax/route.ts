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

    // Reservo todos los nombres up-front (sync, ultra rapido) para evitar colisiones
    // entre escrituras paralelas. Despues escribo en paralelo con writeFile async.
    const skipped: string[] = [];
    const errors: string[] = [];
    const reserved = new Set<string>();
    const tasks: Array<{ file: File; fullPath: string }> = [];
    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) { skipped.push(`${file.name} (>50MB)`); continue; }
      // uniqueName checa el disco; pero si dos archivos del mismo upload tienen el mismo
      // nombre, ambos resuelven a igual; reservo manualmente.
      let candidate = uniqueName(folder.dir, sanitizeFilename(file.name));
      while (reserved.has(candidate)) {
        const ext = path.extname(candidate);
        const base = candidate.slice(0, candidate.length - ext.length);
        candidate = `${base} (${reserved.size})${ext}`;
      }
      reserved.add(candidate);
      const fullPath = path.join(folder.dir, candidate);
      if (!fullPath.startsWith(folder.dir)) { errors.push(`${file.name} (path traversal)`); continue; }
      tasks.push({ file, fullPath });
    }

    // Escritura paralela: writeFile async + Promise.all. No bloquea el event loop.
    const results = await Promise.all(tasks.map(async ({ file, fullPath }) => {
      try {
        const buf = Buffer.from(await file.arrayBuffer());
        await fs.promises.writeFile(fullPath, buf);
        return { ok: true as const };
      } catch (e) {
        const err = e as NodeJS.ErrnoException;
        return { ok: false as const, error: `${file.name} (${err.code || err.message})` };
      }
    }));
    const saved = results.filter(r => r.ok).length;
    for (const r of results) if (!r.ok) errors.push(r.error);

    return NextResponse.json({ saved, skipped, errors });
  } catch (err) {
    const e = err as Error;
    console.error('[upload-ajax]', e);
    return NextResponse.json({ error: e.message || 'Error inesperado' }, { status: 500 });
  }
}
