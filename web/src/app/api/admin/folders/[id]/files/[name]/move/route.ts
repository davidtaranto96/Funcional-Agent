import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/session';
import { resolveFolder, safeFilenameInDir, uniqueName } from '@/lib/document-folders';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; name: string }> }) {
  try {
    await requireAuth();
    const { id, name } = await ctx.params;
    const decoded = decodeURIComponent(name);
    const formData = await req.formData();
    const toFolder = String(formData.get('toFolder') || '').trim();
    if (!toFolder) return NextResponse.json({ error: 'Carpeta destino faltante' }, { status: 400 });
    if (toFolder === id) return NextResponse.json({ error: 'Misma carpeta' }, { status: 400 });
    const [from, to] = await Promise.all([resolveFolder(id), resolveFolder(toFolder)]);
    if (!from) return NextResponse.json({ error: 'Carpeta origen no existe' }, { status: 404 });
    if (!to) return NextResponse.json({ error: 'Carpeta destino no existe' }, { status: 404 });
    const fromFull = safeFilenameInDir(from.dir, decoded);
    if (!fromFull || !fs.existsSync(fromFull)) return NextResponse.json({ error: 'Archivo no existe' }, { status: 404 });
    fs.mkdirSync(to.dir, { recursive: true });
    const finalName = uniqueName(to.dir, decoded);
    const toFull = path.join(to.dir, finalName);
    if (!toFull.startsWith(to.dir)) return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
    fs.renameSync(fromFull, toFull);
    return NextResponse.json({ name: finalName, folder: toFolder });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
