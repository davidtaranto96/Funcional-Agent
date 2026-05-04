import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/session';
import { resolveFolder, safeFilenameInDir } from '@/lib/document-folders';

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json', '.html': 'text/html; charset=utf-8',
  '.zip': 'application/zip', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; name: string }> }) {
  await requireAuth();
  const { id, name } = await ctx.params;
  const decoded = decodeURIComponent(name);
  const folder = await resolveFolder(id);
  if (!folder) return new NextResponse('Not found', { status: 404 });
  const full = safeFilenameInDir(folder.dir, decoded);
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) return new NextResponse('Not found', { status: 404 });
  const ext = path.extname(full).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const buf = fs.readFileSync(full);
  const previewable = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.txt', '.csv', '.html'];
  const disposition = previewable.includes(ext)
    ? `inline; filename="${encodeURIComponent(decoded)}"`
    : `attachment; filename="${encodeURIComponent(decoded)}"`;
  return new NextResponse(buf, { status: 200, headers: { 'Content-Type': mime, 'Content-Disposition': disposition } });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; name: string }> }) {
  try {
    await requireAuth();
    const { id, name } = await ctx.params;
    const decoded = decodeURIComponent(name);
    const formData = await req.formData().catch(() => null);
    const action = String(formData?.get('action') || 'delete');
    if (action !== 'delete') return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    const folder = await resolveFolder(id);
    if (!folder) return NextResponse.json({ error: 'folder not found' }, { status: 404 });
    const full = safeFilenameInDir(folder.dir, decoded);
    if (!full) return NextResponse.json({ error: 'invalid path' }, { status: 400 });
    if (!fs.existsSync(full)) return NextResponse.json({ error: 'file not found' }, { status: 404 });
    fs.unlinkSync(full);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as Error;
    console.error('[file/delete]', e);
    return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
  }
}
