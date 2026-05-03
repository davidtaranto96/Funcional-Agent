import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/session';

export const runtime = 'nodejs';

const DOCUMENTS_DIR = path.resolve(process.cwd(), '..', 'data', 'documents');

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

function safeFile(folderId: string, name: string): string | null {
  const folderDir = path.resolve(DOCUMENTS_DIR, folderId);
  if (!folderDir.startsWith(path.resolve(DOCUMENTS_DIR))) return null;
  const full = path.resolve(folderDir, name);
  if (!full.startsWith(folderDir)) return null;
  return full;
}

// GET: download (or inline for safe types)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; name: string }> }) {
  await requireAuth();
  const { id, name } = await ctx.params;
  const decoded = decodeURIComponent(name);
  const full = safeFile(id, decoded);
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return new NextResponse('Not found', { status: 404 });
  }
  const ext = path.extname(full).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const buf = fs.readFileSync(full);

  // Inline para tipos previsualizables, attachment para el resto
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

  if (action === 'delete') {
    const full = safeFile(id, decoded);
    if (full && fs.existsSync(full)) {
      fs.unlinkSync(full);
    }
  }

  return NextResponse.redirect(new URL(`/admin/documentos/${id}`, req.url), { status: 303 });
}
