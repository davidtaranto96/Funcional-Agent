// Resolver unificado de "carpetas de documentos".
//
// Hay 3 tipos de carpetas que aparecen en el Drive:
// - custom (df_*) — carpetas creadas manualmente por el usuario en data/documents/
// - project (pf_*) — archivos del proyecto, guardados en data/project-files/{projectId}/
// - demo WA (wd_*) — archivos generados por el bot, en data/demos/{phone}/
//
// Todas las URLs comparten el formato /admin/documentos/{id} y los API endpoints
// /api/admin/folders/{id}/... — el id determina el tipo y la ubicación física.

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
  // Capabilities — lo que se puede hacer en esta carpeta
  canDelete: boolean;
  canRenameFolder: boolean;
  canCreateFolder: boolean;
  // Display
  subtitle: string;
}

const DATA_DIR = path.resolve(process.cwd(), '..', 'data');
const DOCS_DIR = path.join(DATA_DIR, 'documents');
const PROJECT_FILES_DIR = path.join(DATA_DIR, 'project-files');
const DEMOS_DIR = path.join(DATA_DIR, 'demos');

function safeJoin(base: string, segment: string): string | null {
  const resolved = path.resolve(base, segment);
  if (!resolved.startsWith(path.resolve(base))) return null;
  return resolved;
}

export async function resolveFolder(id: string): Promise<ResolvedFolder | null> {
  if (!id) return null;

  if (id.startsWith('df_') || (!id.startsWith('pf_') && !id.startsWith('wd_'))) {
    // Custom folder (también soportamos legacy IDs sin prefijo)
    const folders = await db.listDocumentFolders();
    const f = folders.find(x => x.id === id);
    if (!f) return null;
    const dir = safeJoin(DOCS_DIR, id);
    if (!dir) return null;
    return {
      id,
      type: 'custom',
      name: f.name,
      color: f.color,
      description: f.description,
      dir,
      canDelete: true,
      canRenameFolder: true,
      canCreateFolder: true,
      subtitle: f.description || 'Carpeta personal',
    };
  }

  if (id.startsWith('pf_')) {
    const projectId = id.slice(3);
    const project = await db.getProject(projectId);
    if (!project) return null;
    const dir = safeJoin(PROJECT_FILES_DIR, projectId);
    if (!dir) return null;
    return {
      id,
      type: 'project',
      name: project.title || 'Proyecto sin título',
      color: '#8b5cf6',
      description: project.description || '',
      dir,
      canDelete: false, // no borrás un proyecto desde acá
      canRenameFolder: false,
      canCreateFolder: false,
      subtitle: project.client_name ? `Proyecto · ${project.client_name}` : 'Proyecto',
    };
  }

  if (id.startsWith('wd_')) {
    const phone = id.slice(3);
    const conv = await db.getConversation(phone);
    if (!conv) return null;
    const dir = safeJoin(DEMOS_DIR, phone);
    if (!dir) return null;
    const name = conv.report?.cliente?.nombre || phone;
    return {
      id,
      type: 'demo',
      name,
      color: '#10b981',
      description: conv.report?.proyecto?.tipo || '',
      dir,
      canDelete: false,
      canRenameFolder: false,
      canCreateFolder: false,
      subtitle: 'Demo WhatsApp',
    };
  }

  return null;
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

function countFiles(dir: string): { count: number; bytes: number } {
  if (!fs.existsSync(dir)) return { count: 0, bytes: 0 };
  let count = 0; let bytes = 0;
  try {
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('.')) continue;
      const full = path.join(dir, f);
      try {
        const st = fs.statSync(full);
        if (st.isFile()) { count++; bytes += st.size; }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return { count, bytes };
}

export async function listAllFolders(): Promise<{
  custom: FolderListing[];
  projects: FolderListing[];
  demos: FolderListing[];
  totalFiles: number;
  totalBytes: number;
}> {
  const [folders, projects, conversations] = await Promise.all([
    db.listDocumentFolders(),
    db.listProjects(),
    db.listAllClients(),
  ]);

  const custom: FolderListing[] = folders.map(f => {
    const dir = safeJoin(DOCS_DIR, f.id) || '';
    const { count, bytes } = dir ? countFiles(dir) : { count: 0, bytes: 0 };
    return {
      id: f.id,
      type: 'custom' as const,
      name: f.name,
      color: f.color,
      subtitle: f.description || 'Carpeta personal',
      fileCount: count,
      bytes,
      description: f.description,
      href: `/admin/documentos/${f.id}`,
    };
  });

  const projectFolders: FolderListing[] = projects.map(p => {
    const dir = safeJoin(PROJECT_FILES_DIR, p.id) || '';
    const { count, bytes } = dir ? countFiles(dir) : { count: 0, bytes: 0 };
    return {
      id: `pf_${p.id}`,
      type: 'project' as const,
      name: p.title || 'Sin título',
      color: '#8b5cf6',
      subtitle: p.client_name || 'Sin cliente',
      fileCount: count,
      bytes,
      description: p.description,
      href: `/admin/documentos/pf_${p.id}`,
    };
  });

  const demoFolders: FolderListing[] = conversations
    .filter(c => c.demo_status === 'sent' || c.demo_status === 'approved' || c.demo_status === 'pending_review')
    .map(c => {
      const dir = safeJoin(DEMOS_DIR, c.phone) || '';
      const { count, bytes } = dir ? countFiles(dir) : { count: 0, bytes: 0 };
      const name = c.report?.cliente?.nombre || c.phone;
      return {
        id: `wd_${c.phone}`,
        type: 'demo' as const,
        name,
        color: '#10b981',
        subtitle: c.report?.proyecto?.tipo || 'Demo WA',
        fileCount: count,
        bytes,
        href: `/admin/documentos/wd_${c.phone}`,
      };
    });

  // Solo mostramos proyectos/demos que tienen archivos (sino dispersa la vista)
  const projectsWithFiles = projectFolders.filter(p => p.fileCount > 0);
  const demosWithFiles = demoFolders.filter(d => d.fileCount > 0);

  const allShown = [...custom, ...projectsWithFiles, ...demosWithFiles];
  const totalFiles = allShown.reduce((s, f) => s + f.fileCount, 0);
  const totalBytes = allShown.reduce((s, f) => s + f.bytes, 0);

  return {
    custom,
    projects: projectsWithFiles,
    demos: demosWithFiles,
    totalFiles,
    totalBytes,
  };
}

export function listFolderFiles(dir: string): { name: string; size: number; mtime: string; ext: string }[] {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter(f => !f.startsWith('.'))
      .map(name => {
        const full = path.join(dir, name);
        try {
          const stat = fs.statSync(full);
          if (!stat.isFile()) return null;
          return {
            name,
            size: stat.size,
            mtime: stat.mtime.toISOString(),
            ext: path.extname(name).toLowerCase(),
          };
        } catch { return null; }
      })
      .filter((x): x is { name: string; size: number; mtime: string; ext: string } => x !== null)
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch {
    return [];
  }
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
