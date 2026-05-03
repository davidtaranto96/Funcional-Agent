import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/session';
import { resolveFolder, safeFilenameInDir, sanitizeFilename } from '@/lib/document-folders';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; name: string }> }) {
  await requireAuth();
  const { id, name } = await ctx.params;
  const oldDecoded = decodeURIComponent(name);

  const folder = await resolveFolder(id);
  if (!folder) return NextResponse.json({ error: 'folder not found' }, { status: 404 });

  const formData = await req.formData();
  const newRaw = String(formData.get('newName') || '').trim();
  if (!newRaw) return NextResponse.json({ error: 'Nombre vacío' }, { status: 400 });

  const newSafe = sanitizeFilename(newRaw);
  const oldFull = safeFilenameInDir(folder.dir, oldDecoded);
  const newFull = safeFilenameInDir(folder.dir, newSafe);
  if (!oldFull || !newFull) return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
  if (!fs.existsSync(oldFull)) return NextResponse.json({ error: 'Archivo no existe' }, { status: 404 });
  if (oldFull === newFull) return NextResponse.json({ name: newSafe, ext: path.extname(newSafe).toLowerCase() });
  if (fs.existsSync(newFull)) return NextResponse.json({ error: 'Ya existe un archivo con ese nombre' }, { status: 409 });

  fs.renameSync(oldFull, newFull);
  return NextResponse.json({ name: newSafe, ext: path.extname(newSafe).toLowerCase() });
}
