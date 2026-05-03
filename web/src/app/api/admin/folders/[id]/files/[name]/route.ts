import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';
import { resolveFolder, safeFilenameInDir } from '@/lib/document-folders';

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json',
  '.html': 'text/html; charset=utf-8',
  '.zip': 'application/zip',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// GET: download (or inline preview)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; name: string }> }) {
  await requireAuth();
  const { id, name } = await ctx.params;
  const decoded = decodeURIComponent(name);

  const folder = await resolveFolder(id);
  if (!folder) return new NextResponse('Not found', { status: 404 });

  const full = safeFilenameInDir(folder.dir, decoded);
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return new NextResponse('Not found', { status: 404 });
  }

  const ext = path.extname(full).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const buf = fs.readFileSync(full);

  const previewable = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.txt', '.csv'];
  const disposition = previewable.includes(ext)
    ? `inline; filename="${encodeURIComponent(decoded)}"`
    : `attachment; filename="${encodeURIComponent(decoded)}"`;

  return new NextResponse(buf, {
    status: 200,
    headers: { 'Content-Type': mime, 'Content-Disposition': disposition },
  });
}

// POST con action=delete: borrar archivo
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; name: string }> }) {
  await requireAuth();
  const { id, name } = await ctx.params;
  const decoded = decodeURIComponent(name);
  const formData = await req.formData().catch(() => null);
  const action = String(formData?.get('action') || 'delete');

  const folder = await resolveFolder(id);
  if (!folder) return new NextResponse('Not found', { status: 404 });

  if (action === 'delete') {
    const full = safeFilenameInDir(folder.dir, decoded);
    if (full && fs.existsSync(full)) {
      fs.unlinkSync(full);
    }
  }

  return NextResponse.redirect(publicUrl(req, `/admin/documentos/${id}`), { status: 303 });
}
