import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/session';

export const runtime = 'nodejs';

const DOCUMENTS_DIR = path.resolve(process.cwd(), '..', 'data', 'documents');

function sanitizeFilename(raw: string): string {
  const base = path.basename(raw || 'file');
  const safe = base.replace(/[^a-zA-Z0-9._\-áéíóúÁÉÍÓÚñÑüÜ ]/g, '_');
  if (safe === '..' || safe === '.' || !safe) return `file_${Date.now()}`;
  return safe;
}

function safeFile(folderId: string, name: string): string | null {
  const folderDir = path.resolve(DOCUMENTS_DIR, folderId);
  if (!folderDir.startsWith(path.resolve(DOCUMENTS_DIR))) return null;
  const full = path.resolve(folderDir, name);
  if (!full.startsWith(folderDir)) return null;
  return full;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; name: string }> }) {
  await requireAuth();
  const { id, name } = await ctx.params;
  const oldDecoded = decodeURIComponent(name);
  const formData = await req.formData();
  const newRaw = String(formData.get('newName') || '').trim();
  if (!newRaw) return NextResponse.json({ error: 'Nombre vacío' }, { status: 400 });

  const newSafe = sanitizeFilename(newRaw);
  const oldFull = safeFile(id, oldDecoded);
  const newFull = safeFile(id, newSafe);
  if (!oldFull || !newFull) return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
  if (!fs.existsSync(oldFull)) return NextResponse.json({ error: 'Archivo no existe' }, { status: 404 });
  if (oldFull === newFull) return NextResponse.json({ name: newSafe, ext: path.extname(newSafe).toLowerCase() });
  if (fs.existsSync(newFull)) return NextResponse.json({ error: 'Ya existe un archivo con ese nombre' }, { status: 409 });

  fs.renameSync(oldFull, newFull);
  return NextResponse.json({ name: newSafe, ext: path.extname(newSafe).toLowerCase() });
}
