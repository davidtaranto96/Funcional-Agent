import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import path from 'path';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function phoneSlug(phone: string | null | undefined): string {
  return (phone || '').replace(/[^0-9]/g, '');
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = dateStr + (dateStr.endsWith('Z') ? '' : 'Z');
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const days = Math.floor(h / 24);
  return `hace ${days}d`;
}

export function formatARS(n: number | string | null | undefined, opts: { zeroAsDash?: boolean } = {}): string {
  const { zeroAsDash = true } = opts;
  const num = typeof n === 'number' ? n : Number(String(n || '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(num)) return '—';
  if (num === 0 && zeroAsDash) return '—';
  // Intl pone "$ 1.000" con espacio. Sacamos el espacio non-breaking (U+00A0) entre símbolo y número.
  const s = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(num);
  return s.replace(/ /g, '').replace('$ ', '$');
}

export function safePath(base: string, ...parts: string[]): string {
  const resolved = path.resolve(path.join(base, ...parts));
  if (!resolved.startsWith(path.resolve(base))) throw new Error('Path traversal blocked');
  return resolved;
}

export function normalizeARPhone(num: string): string {
  let n = (num || '').replace(/\D/g, '');
  if (n.startsWith('549') && n.length === 13) n = '54' + n.slice(3);
  n = n.replace(/^(54\d{3,4})15(\d{6,7})$/, '$1$2');
  return n;
}

/**
 * Construye URL absoluta respetando los headers de proxy (Railway/Vercel/etc).
 * Resuelve el bug de `new URL('/admin', req.url)` que en runtime detrás de proxy
 * usa la URL interna del container (ej. http://0.0.0.0:3000) en lugar de la pública.
 */
export function publicUrl(req: Request, pathname: string): URL {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
  if (host) return new URL(pathname, `${proto}://${host}`);
  return new URL(pathname, req.url);
}
