import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const DEMOS_DIR = path.resolve(process.cwd(), '..', 'data', 'demos');

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

export async function GET(_req: Request, ctx: { params: Promise<{ phone: string; path: string[] }> }) {
  const { phone, path: parts } = await ctx.params;

  // Sanitizar phone (solo dígitos)
  const slug = (phone || '').replace(/[^0-9]/g, '');
  if (!slug) return new NextResponse('Not found', { status: 404 });

  // Path safety — no traversal
  const filename = parts.join('/');
  const fullPath = path.resolve(DEMOS_DIR, slug, filename);
  const expectedPrefix = path.resolve(DEMOS_DIR, slug);
  if (!fullPath.startsWith(expectedPrefix)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    return new NextResponse('Not found', { status: 404 });
  }

  const ext = path.extname(fullPath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const buf = fs.readFileSync(fullPath);

  // Sandbox header en HTML demos — defense in depth contra XSS via prompt injection
  const headers: Record<string, string> = { 'Content-Type': mime };
  if (ext === '.html' || ext === '.htm') {
    headers['Content-Security-Policy'] = "sandbox allow-scripts; default-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com data:; img-src * data:; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com";
  }

  return new NextResponse(buf, { status: 200, headers });
}
