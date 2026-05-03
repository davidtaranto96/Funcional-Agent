import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/session';
import * as db from '@/lib/db';

export const runtime = 'nodejs';

const DOCUMENTS_DIR = path.resolve(process.cwd(), '..', 'data', 'documents');

// Sanitize filename: keep alphanumeric, dots (single, no traversal), dashes, spaces, accents
function sanitizeFilename(raw: string): string {
  // Strip path components first
  const base = path.basename(raw || 'file');
  // Replace anything outside the safe set with _
  const safe = base.replace(/[^a-zA-Z0-9._\-áéíóúÁÉÍÓÚñÑüÜ ]/g, '_');
  // Reject pure '..' or '.' results
  if (safe === '..' || safe === '.' || !safe) return `file_${Date.now()}`;
  return safe;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;

  // Validate folder exists in DB
  const folders = await db.listDocumentFolders();
  if (!folders.find(f => f.id === id)) {
    return NextResponse.json({ error: 'folder not found' }, { status: 404 });
  }

  const folderDir = path.resolve(DOCUMENTS_DIR, id);
  // Path traversal guard
  if (!folderDir.startsWith(path.resolve(DOCUMENTS_DIR))) {
    return NextResponse.json({ error: 'invalid folder' }, { status: 400 });
  }
  fs.mkdirSync(folderDir, { recursive: true });

  const formData = await req.formData();
  const files = formData.getAll('files') as File[];
  if (files.length === 0) {
    return NextResponse.redirect(new URL(`/admin/documentos/${id}`, req.url), { status: 303 });
  }

  let saved = 0;
  for (const file of files) {
    if (!(file instanceof File)) continue;
    if (file.size > 50 * 1024 * 1024) continue; // 50MB cap
    const filename = sanitizeFilename(file.name);
    const fullPath = path.join(folderDir, filename);
    if (!fullPath.startsWith(folderDir)) continue;
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(fullPath, buf);
    saved++;
  }

  return NextResponse.redirect(new URL(`/admin/documentos/${id}?uploaded=${saved}`, req.url), { status: 303 });
}
