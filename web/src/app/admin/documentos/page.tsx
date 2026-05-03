import * as db from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { DocumentosView } from './DocumentosView';

const DOCUMENTS_DIR = path.resolve(process.cwd(), '..', 'data', 'documents');

function countFiles(folderId: string): number {
  const dir = path.resolve(DOCUMENTS_DIR, folderId);
  if (!dir.startsWith(path.resolve(DOCUMENTS_DIR))) return 0;
  if (!fs.existsSync(dir)) return 0;
  try {
    return fs.readdirSync(dir).filter(f => {
      try { return fs.statSync(path.join(dir, f)).isFile() && !f.startsWith('.'); } catch { return false; }
    }).length;
  } catch { return 0; }
}

function totalSize(folderIds: string[]): number {
  let bytes = 0;
  for (const id of folderIds) {
    const dir = path.resolve(DOCUMENTS_DIR, id);
    if (!dir.startsWith(path.resolve(DOCUMENTS_DIR))) continue;
    if (!fs.existsSync(dir)) continue;
    try {
      for (const f of fs.readdirSync(dir)) {
        try {
          const st = fs.statSync(path.join(dir, f));
          if (st.isFile() && !f.startsWith('.')) bytes += st.size;
        } catch {}
      }
    } catch {}
  }
  return bytes;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(2)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export const dynamic = 'force-dynamic';

export default async function DocumentosPage() {
  const [folders, projects, clients] = await Promise.all([
    db.listDocumentFolders(),
    db.listProjects(),
    db.listAllClients(),
  ]);

  const fileCounts = Object.fromEntries(folders.map(f => [f.id, countFiles(f.id)]));
  const totalFiles = Object.values(fileCounts).reduce((s, n) => s + n, 0);
  const usedBytes = totalSize(folders.map(f => f.id));

  // Proyectos con drive folder
  const projectFolders = projects
    .filter(p => p.client_name || p.title)
    .slice(0, 8)
    .map(p => ({
      id: p.id,
      name: p.title || 'Sin título',
      sub: p.client_name || 'Personal',
      color: 'oklch(0.62 0.18 290)',
    }));

  // Demos WA: leads con demo_status = sent o approved
  const demoFolders = clients
    .filter(c => c.demo_status === 'sent' || c.demo_status === 'approved' || c.demo_status === 'pending_review')
    .slice(0, 8)
    .map(c => {
      const name = c.report?.cliente?.nombre || c.phone;
      return {
        id: c.phone,
        name,
        sub: c.report?.proyecto?.tipo || 'Demo WA',
        initials: name.charAt(0).toUpperCase(),
      };
    });

  return (
    <DocumentosView
      folders={folders.map(f => ({ ...f, _count: fileCounts[f.id] || 0 }))}
      projectFolders={projectFolders}
      demoFolders={demoFolders}
      stats={{
        totalFiles,
        totalFolders: folders.length,
        usedLabel: formatBytes(usedBytes),
        capLabel: '~1 GB · Railway Volume',
        usedPct: Math.min(100, (usedBytes / (1024 * 1024 * 1024)) * 100),
      }}
    />
  );
}
