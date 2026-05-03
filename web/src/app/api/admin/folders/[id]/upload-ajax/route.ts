import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/session';
import * as db from '@/lib/db';

export const runtime = 'nodejs';

const DOCUMENTS_DIR = path.resolve(process.cwd(), '..', 'data', 'documents');

function sanitizeFilename(raw: string): string {
  const base = path.basename(raw || 'file');
  const safe = base.replace(/[^a-zA-Z0-9._\-áéíóúÁÉÍÓÚñÑüÜ ]/g, '_');
  if (safe === '..' || safe === '.' || !safe) return `file_${Date.now()}`;
  return safe;
}

function uniqueName(folderDir: string, name: string): string {
  let final = name;
  if (!fs.existsSync(path.join(folderDir, final))) return final;
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let i = 2;
  while (fs.existsSync(path.join(folderDir, `${base} (${i})${ext}`)) && i < 999) i++;
  final = `${base} (${i})${ext}`;
  return final;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;

  const folders = await db.listDocumentFolders();
  if (!folders.find(f => f.id === id)) {
    return NextResponse.json({ error: 'folder not found' }, { status: 404 });
  }

  const folderDir = path.resolve(DOCUMENTS_DIR, id);
  if (!folderDir.startsWith(path.resolve(DOCUMENTS_DIR))) {
    return NextResponse.json({ error: 'invalid folder' }, { status: 400 });
  }
  fs.mkdirSync(folderDir, { recursive: true });

  const formData = await req.formData();
  const files = formData.getAll('files') as File[];
  if (files.length === 0) return NextResponse.json({ saved: 0 });

  let saved = 0;
  const skipped: string[] = [];
  for (const file of files) {
    if (!(file instanceof File)) continue;
    if (file.size > 50 * 1024 * 1024) {
      skipped.push(`${file.name} (>50MB)`);
      continue;
    }
    const filename = uniqueName(folderDir, sanitizeFilename(file.name));
    const fullPath = path.join(folderDir, filename);
    if (!fullPath.startsWith(folderDir)) continue;
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(fullPath, buf);
    saved++;
  }

  return NextResponse.json({ saved, skipped });
}
