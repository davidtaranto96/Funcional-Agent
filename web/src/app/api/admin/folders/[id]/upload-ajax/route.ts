import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { requireAuth } from '@/lib/session';
import { resolveFolder, sanitizeFilename, uniqueName } from '@/lib/document-folders';
import path from 'path';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;

  const folder = await resolveFolder(id);
  if (!folder) return NextResponse.json({ error: 'folder not found' }, { status: 404 });

  fs.mkdirSync(folder.dir, { recursive: true });

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
    const filename = uniqueName(folder.dir, sanitizeFilename(file.name));
    const fullPath = path.join(folder.dir, filename);
    if (!fullPath.startsWith(folder.dir)) continue;
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(fullPath, buf);
    saved++;
  }

  return NextResponse.json({ saved, skipped });
}
