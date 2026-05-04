// Resolver unificado de "carpetas de documentos" — versión Next.js-only.
//
// Hay 3 tipos de carpetas en el Drive:
// - custom (df_*) — carpetas creadas manualmente por el usuario
//                   en data/documents/{id}/
// - project (pf_*) — archivos del proyecto, en data/project-files/{projectId}/
// - demo WA (wd_*) — archivos generados por el bot, en data/demos/{phone}/
//
// El volume de Railway está montado en /app/data, accesible directamente
// desde este servicio Next.js (eliminamos el proxy).

import fs from 'fs';
import path from 'path';
import * as db from './db';

export type FolderType = 'custom' | 'project' | 'demo';

export interface ResolvedFolder {
  id: string;
  type: FolderType;
  name: string;
  color: string;
  description: string;
  dir: string;
  canDelete: boolean;
  canRenameFolder: boolean;
  canCreateFolder: boolean;
  subtitle: string;
}

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

// Resolver inteligente de DATA_DIR — prueba varios paths y elige el escribible.
import { resolveDataDir } from './bot/data-dir';
let _DATA_DIR: string | null = null;
function dataDir(): string {
  if (!_DATA_DIR) _DATA_DIR = resolveDataDir();
  return _DATA_DIR;
}
const DOCS_DIR_NAME = 'documents';
const PROJECT_FILES_DIR_NAME = 'project-files';
const DEMOS_DIR_NAME = 'demos';

function safeJoin(base: string, segment: string): string | null {
  const resolved = path.resolve(base, segment);
  if (!resolved.startsWith(path.resolve(base))) return null;
  return resolved;
}

export async function resolveFolder(id: string): Promise<ResolvedFolder | null> {
  if (!id) return null;

  if (id.startsWith('df_') || (!id.startsWith('pf_') && !id.startsWith('wd_'))) {
    const folders = await db.listDocumentFolders();
    const f = folders.find(x => x.id === id);
    if (!f) return null;
    const dir = safeJoin(path.join(dataDir(), DOCS_DIR_NAME), id);
    if (!dir) return null;
    return {
      id, type: 'custom', name: f.name, color: f.color, description: f.description, dir,
      canDelete: true, canRenameFolder: true, canCreateFolder: true,
      subtitle: f.description || 'Carpeta personal',
    };
  }

  if (id.startsWith('pf_')) {
    const projectId = id.slice(3);
    const project = await db.getProject(projectId);
    if (!project) return null;
    const dir = safeJoin(path.join(dataDir(), PROJECT_FILES_DIR_NAME), projectId);
    if (!dir) return null;
    return {
      id, type: 'project', name: project.title || 'Proyecto sin título', color: '#8b5cf6',
      description: project.description || '', dir,
      canDelete: false, canRenameFolder: false, canCreateFolder: false,
      subtitle: project.client_name ? `Proyecto · ${project.client_name}` : 'Proyecto',
    };
  }

  if (id.startsWith('wd_')) {
    const phone = id.slice(3);
    const conv = await db.getConversation(phone);
    if (!conv) return null;
    const dir = safeJoin(path.join(dataDir(), DEMOS_DIR_NAME), phone);
    if (!dir) return null;
    const name = conv.report?.cliente?.nombre || phone;
    return {
      id, type: 'demo', name, color: '#10b981', description: conv.report?.proyecto?.tipo || '', dir,
      canDelete: false, canRenameFolder: false, canCreateFolder: false,
      subtitle: 'Demo WhatsApp',
    };
  }

  return null;
}

function countFiles(dir: string): { count: number; bytes: number } {
  let count = 0; let bytes = 0;
  try {
    // withFileTypes evita un statSync por entrada solo para chequear si es archivo.
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.') || !e.isFile()) continue;
      try {
        const st = fs.statSync(path.join(dir, e.name));
        count++; bytes += st.size;
      } catch { /* skip */ }
    }
  } catch { /* dir no existe o sin permisos */ }
  return { count, bytes };
}

export function listFolderFiles(dir: string): FolderFile[] {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const out: FolderFile[] = [];
    for (const e of entries) {
      if (e.name.startsWith('.') || !e.isFile()) continue;
      try {
        const stat = fs.statSync(path.join(dir, e.name));
        out.push({
          name: e.name,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
          ext: path.extname(e.name).toLowerCase(),
        });
      } catch { /* skip */ }
    }
    return out.sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch {
    return [];
  }
}

export async function listAllFolders(): Promise<AllFoldersResult> {
  // listAllClientsLite() en vez de listAllClients(): no parsea history/timeline,
  // usa json_extract para nombre cliente + tipo proyecto. Mucho mas rapido.
  const [folders, projects, conversations] = await Promise.all([
    db.listDocumentFolders(),
    db.listProjects(),
    db.listAllClientsLite(),
  ]);

  const custom: FolderListing[] = folders.map(f => {
    const dir = safeJoin(path.join(dataDir(), DOCS_DIR_NAME), f.id) || '';
    const { count, bytes } = dir ? countFiles(dir) : { count: 0, bytes: 0 };
    return {
      id: f.id, type: 'custom', name: f.name, color: f.color,
      subtitle: f.description || 'Carpeta personal',
      fileCount: count, bytes, description: f.description,
      href: `/admin/documentos/${f.id}`,
    };
  });

  const projectFolders: FolderListing[] = projects.map(p => {
    const dir = safeJoin(path.join(dataDir(), PROJECT_FILES_DIR_NAME), p.id) || '';
    const { count, bytes } = dir ? countFiles(dir) : { count: 0, bytes: 0 };
    return {
      id: `pf_${p.id}`, type: 'project', name: p.title || 'Sin título',
      color: '#8b5cf6', subtitle: p.client_name || 'Sin cliente',
      fileCount: count, bytes, description: p.description,
      href: `/admin/documentos/pf_${p.id}`,
    };
  });

  const demoFolders: FolderListing[] = conversations
    .filter(c => c.demo_status === 'sent' || c.demo_status === 'approved' || c.demo_status === 'pending_review')
    .map(c => {
      const dir = safeJoin(path.join(dataDir(), DEMOS_DIR_NAME), c.phone) || '';
      const { count, bytes } = dir ? countFiles(dir) : { count: 0, bytes: 0 };
      const name = c.clientName || c.phone;
      return {
        id: `wd_${c.phone}`, type: 'demo', name, color: '#10b981',
        subtitle: c.projectType || 'Demo WA',
        fileCount: count, bytes,
        href: `/admin/documentos/wd_${c.phone}`,
      };
    });

  const projectsWithFiles = projectFolders.filter(p => p.fileCount > 0);
  const demosWithFiles = demoFolders.filter(d => d.fileCount > 0);
  const allShown = [...custom, ...projectsWithFiles, ...demosWithFiles];
  const totalFiles = allShown.reduce((s, f) => s + f.fileCount, 0);
  const totalBytes = allShown.reduce((s, f) => s + f.bytes, 0);

  return { custom, projects: projectsWithFiles, demos: demosWithFiles, totalFiles, totalBytes };
}

// Liviana: devuelve solo metadata de carpetas (id/name/color/type) para
// pickers/dropdowns. NO toca el filesystem ni cuenta archivos. Mucho más rápida
// que listAllFolders() cuando solo se necesita la lista de destinos para mover.
export interface FolderTarget {
  id: string;
  name: string;
  color: string;
  type: FolderType;
}

export async function listFolderTargets(excludeId?: string): Promise<FolderTarget[]> {
  const [folders, projects, conversations] = await Promise.all([
    db.listDocumentFolders(),
    db.listProjects(),
    db.listAllClientsLite(),
  ]);

  const out: FolderTarget[] = [];
  for (const f of folders) {
    out.push({ id: f.id, name: f.name, color: f.color, type: 'custom' });
  }
  for (const p of projects) {
    out.push({ id: `pf_${p.id}`, name: p.title || 'Sin título', color: '#8b5cf6', type: 'project' });
  }
  for (const c of conversations) {
    if (c.demo_status === 'sent' || c.demo_status === 'approved' || c.demo_status === 'pending_review') {
      const name = c.clientName || c.phone;
      out.push({ id: `wd_${c.phone}`, name, color: '#10b981', type: 'demo' });
    }
  }
  return excludeId ? out.filter(t => t.id !== excludeId) : out;
}

export async function getFolderWithFiles(id: string): Promise<FolderWithFilesResult | null> {
  const folder = await resolveFolder(id);
  if (!folder) return null;
  const files = listFolderFiles(folder.dir);
  return {
    folder: {
      id: folder.id, name: folder.name, color: folder.color,
      description: folder.description, type: folder.type, subtitle: folder.subtitle,
    },
    files,
  };
}

export function safeFilenameInDir(dir: string, name: string): string | null {
  const full = path.resolve(dir, name);
  if (!full.startsWith(path.resolve(dir))) return null;
  return full;
}

export function sanitizeFilename(raw: string): string {
  const base = path.basename(raw || 'file');
  const safe = base.replace(/[^a-zA-Z0-9._\-áéíóúÁÉÍÓÚñÑüÜ ]/g, '_');
  if (safe === '..' || safe === '.' || !safe) return `file_${Date.now()}`;
  return safe;
}

export function uniqueName(dir: string, name: string): string {
  if (!fs.existsSync(path.join(dir, name))) return name;
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let i = 2;
  while (fs.existsSync(path.join(dir, `${base} (${i})${ext}`)) && i < 999) i++;
  return `${base} (${i})${ext}`;
}
