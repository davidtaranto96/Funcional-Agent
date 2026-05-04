import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const PROJECT_FILES_DIR = path.resolve(process.cwd(), '..', 'data', 'project-files');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; path: string[] }> }) {
  const { id, path: parts } = await ctx.params;

  const safeId = (id || '').replace(/[^a-zA-Z0-9_\-]/g, '');
  if (!safeId) return new NextResponse('Not found', { status: 404 });

  const filename = parts.join('/');
  const fullPath = path.resolve(PROJECT_FILES_DIR, safeId, filename);
  const expectedPrefix = path.resolve(PROJECT_FILES_DIR, safeId);
  if (!fullPath.startsWith(expectedPrefix)) return new NextResponse('Forbidden', { status: 403 });
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return new NextResponse('Not found', { status: 404 });

  const ext = path.extname(fullPath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const buf = fs.readFileSync(fullPath);
  return new NextResponse(buf, { status: 200, headers: { 'Content-Type': mime } });
}
