// Cliente HTTP al servicio Funcional-Agent (Express) que tiene el volume montado.
//
// Como Railway no permite compartir volumes entre servicios, Next.js delega
// las operaciones de archivos al Funcional-Agent via REST.
//
// Config requerida en Railway → NEXT.JS → Variables:
//   FUNCIONAL_AGENT_URL  = http://funcional-agent.railway.internal:3000
//   ADMIN_API_TOKEN      = (mismo valor que tiene el Funcional-Agent)
//
// La URL interna `*.railway.internal` no consume bandwidth público y es más rápida.
// Como fallback usamos la URL pública del servicio.

const DEFAULT_INTERNAL = 'http://funcional-agent.railway.internal:3000';
const DEFAULT_PUBLIC = 'https://funcional-agent-production.up.railway.app';

function getBaseUrl(): string {
  return (process.env.FUNCIONAL_AGENT_URL || DEFAULT_INTERNAL).replace(/\/$/, '');
}

function getToken(): string {
  return process.env.ADMIN_API_TOKEN || '';
}

class ProxyError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, opts: RequestInit & { query?: Record<string, string> } = {}): Promise<T> {
  const baseUrl = getBaseUrl();
  const token = getToken();
  if (!token) throw new ProxyError('ADMIN_API_TOKEN no configurado en Next.js', 500, null);

  const url = new URL(path, baseUrl);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v);
  }

  const headers = new Headers(opts.headers);
  headers.set('x-admin-token', token);

  const res = await fetch(url.toString(), {
    ...opts,
    headers,
    // Next.js cache: nunca cachear estas requests
    cache: 'no-store',
  });

  // Si el body no es JSON (ej. GET file binary), no parseamos
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) throw new ProxyError(`HTTP ${res.status}`, res.status, await res.text().catch(() => null));
    return res as unknown as T;
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ProxyError((data as { error?: string })?.error || `HTTP ${res.status}`, res.status, data);
  return data as T;
}

// ── Tipos ────────────────────────────────────────────────────────────────────

export type FolderType = 'custom' | 'project' | 'demo';

export interface FolderListing {
  id: string;
  type: FolderType;
  name: string;
  color: string;
  subtitle: string;
  fileCount: number;
  bytes: number;
  description?: string;
  href: string;
}

export interface FolderFile {
  name: string;
  size: number;
  mtime: string;
  ext: string;
}

export interface FolderInfo {
  id: string;
  name: string;
  color: string;
  description?: string;
  type?: FolderType;
  subtitle?: string;
}

export interface AllFoldersResult {
  custom: FolderListing[];
  projects: FolderListing[];
  demos: FolderListing[];
  totalFiles: number;
  totalBytes: number;
}

export interface FolderWithFilesResult {
  folder: FolderInfo;
  files: FolderFile[];
}

// ── API ──────────────────────────────────────────────────────────────────────

export async function listAllFolders(): Promise<AllFoldersResult> {
  return request<AllFoldersResult>('/api/folders/list');
}

export async function getFolderWithFiles(id: string): Promise<FolderWithFilesResult | null> {
  try {
    return await request<FolderWithFilesResult>('/api/folders/files', { query: { id } });
  } catch (err) {
    if (err instanceof ProxyError && err.status === 404) return null;
    throw err;
  }
}

export async function deleteFolder(id: string): Promise<void> {
  await request<{ ok: true }>('/api/folders/delete', { method: 'POST', query: { id } });
}

export async function createFolder(data: { name: string; color?: string; description?: string }): Promise<{ id: string }> {
  return request<{ ok: true; id: string }>('/api/folders/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function uploadFiles(id: string, files: File[]): Promise<{ saved: number; skipped: string[]; errors: string[] }> {
  const baseUrl = getBaseUrl();
  const token = getToken();
  if (!token) throw new ProxyError('ADMIN_API_TOKEN no configurado en Next.js', 500, null);

  const url = new URL('/api/files/upload', baseUrl);
  url.searchParams.set('id', id);

  const fd = new FormData();
  for (const f of files) fd.append('files', f, f.name);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'x-admin-token': token },
    body: fd,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ProxyError((data as { error?: string })?.error || `HTTP ${res.status}`, res.status, data);
  return data as { saved: number; skipped: string[]; errors: string[] };
}

export async function getFile(id: string, name: string): Promise<{ buffer: ArrayBuffer; contentType: string; disposition: string | null }> {
  const baseUrl = getBaseUrl();
  const token = getToken();
  if (!token) throw new ProxyError('ADMIN_API_TOKEN no configurado en Next.js', 500, null);

  const url = new URL('/api/files/get', baseUrl);
  url.searchParams.set('id', id);
  url.searchParams.set('name', name);

  const res = await fetch(url.toString(), { headers: { 'x-admin-token': token }, cache: 'no-store' });
  if (!res.ok) throw new ProxyError(`HTTP ${res.status}`, res.status, await res.text().catch(() => null));
  return {
    buffer: await res.arrayBuffer(),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
    disposition: res.headers.get('content-disposition'),
  };
}

export async function deleteFile(id: string, name: string): Promise<void> {
  await request<{ ok: true }>('/api/files/delete', { method: 'POST', query: { id, name } });
}

export async function renameFile(id: string, name: string, newName: string): Promise<{ name: string; ext: string }> {
  return request<{ name: string; ext: string }>('/api/files/rename', {
    method: 'POST',
    query: { id, name },
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newName }),
  });
}

export async function moveFile(id: string, name: string, toFolder: string): Promise<{ name: string; folder: string }> {
  return request<{ name: string; folder: string }>('/api/files/move', {
    method: 'POST',
    query: { id, name },
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toFolder }),
  });
}

export { ProxyError };
