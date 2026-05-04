import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { requireAuth } from '@/lib/session';
import { resolveFolder, sanitizeFilename, uniqueName } from '@/lib/document-folders';
import path from 'path';

export const runtime = 'nodejs';

// Wrapper para garantizar que SIEMPRE respondemos JSON, incluso ante errores
// inesperados (Next.js por default devuelve HTML en errores no manejados →
// el cliente revienta con "Unexpected end of JSON input").
function jsonError(message: string, status = 500, extra: Record<string, unknown> = {}) {
  console.error(`[upload-ajax] ${status} ${message}`, extra);
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await ctx.params;

    const folder = await resolveFolder(id);
    if (!folder) return jsonError('Carpeta no encontrada', 404, { id });

    // Asegurar que el directorio existe. Si falla, devolvemos JSON con el detalle.
    try {
      fs.mkdirSync(folder.dir, { recursive: true });
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      return jsonError(`No pude crear el directorio (${e.code || 'unknown'})`, 500, {
        path: folder.dir,
        code: e.code,
        hint: e.code === 'EACCES'
          ? 'El servicio Next.js no tiene permisos sobre el volume. Mountealo en Railway → NEXT.JS → Settings → Volumes.'
          : e.code === 'ENOENT'
          ? 'El path padre no existe. El volume puede no estar montado en este servicio.'
          : undefined,
      });
    }

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    if (files.length === 0) return NextResponse.json({ saved: 0 });

    let saved = 0;
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;
      if (file.size > 50 * 1024 * 1024) {
        skipped.push(`${file.name} (>50MB)`);
        continue;
      }
      try {
        const filename = uniqueName(folder.dir, sanitizeFilename(file.name));
        const fullPath = path.join(folder.dir, filename);
        if (!fullPath.startsWith(folder.dir)) {
          errors.push(`${file.name} (path traversal)`);
          continue;
        }
        const buf = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(fullPath, buf);
        saved++;
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        errors.push(`${file.name} (${e.code || e.message})`);
      }
    }

    return NextResponse.json({ saved, skipped, errors });
  } catch (err) {
    const e = err as Error;
    return jsonError(e.message || 'Error inesperado', 500, { stack: e.stack?.slice(0, 300) });
  }
}
