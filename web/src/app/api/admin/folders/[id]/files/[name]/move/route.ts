import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/session';
import * as db from '@/lib/db';

export const runtime = 'nodejs';

const DOCUMENTS_DIR = path.resolve(process.cwd(), '..', 'data', 'documents');

function safePath(folderId: string, name: string): string | null {
  const folderDir = path.resolve(DOCUMENTS_DIR, folderId);
  if (!folderDir.startsWith(path.resolve(DOCUMENTS_DIR))) return null;
  const full = path.resolve(folderDir, name);
  if (!full.startsWith(folderDir)) return null;
  return full;
}

function uniqueName(folderDir: string, name: string): string {
  if (!fs.existsSync(path.join(folderDir, name))) return name;
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let i = 2;
  while (fs.existsSync(path.join(folderDir, `${base} (${i})${ext}`)) && i < 999) i++;
  return `${base} (${i})${ext}`;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; name: string }> }) {
  await requireAuth();
  const { id, name } = await ctx.params;
  const decoded = decodeURIComponent(name);
  const formData = await req.formData();
  const toFolder = String(formData.get('toFolder') || '').trim();
  if (!toFolder) return NextResponse.json({ error: 'Carpeta destino faltante' }, { status: 400 });

  const folders = await db.listDocumentFolders();
  if (!folders.find(f => f.id === toFolder)) {
    return NextResponse.json({ error: 'Carpeta destino no existe' }, { status: 404 });
  }
  if (toFolder === id) return NextResponse.json({ error: 'Misma carpeta' }, { status: 400 });

  const fromFull = safePath(id, decoded);
  const toDir = path.resolve(DOCUMENTS_DIR, toFolder);
  if (!fromFull || !toDir.startsWith(path.resolve(DOCUMENTS_DIR))) {
    return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
  }
  if (!fs.existsSync(fromFull)) return NextResponse.json({ error: 'Archivo no existe' }, { status: 404 });
  fs.mkdirSync(toDir, { recursive: true });

  const finalName = uniqueName(toDir, decoded);
  const toFull = path.join(toDir, finalName);
  if (!toFull.startsWith(toDir)) return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });

  fs.renameSync(fromFull, toFull);
  return NextResponse.json({ name: finalName, folder: toFolder });
}
