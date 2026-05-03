import { notFound } from 'next/navigation';
import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import * as db from '@/lib/db';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Folder, Upload, Trash2, Download, FileText, Image as ImageIcon, FileArchive, Video, Music, File as FileIcon } from 'lucide-react';

export const dynamic = 'force-dynamic';

const DOCUMENTS_DIR = path.resolve(process.cwd(), '..', 'data', 'documents');

interface FolderFile { name: string; size: number; mtime: string; ext: string }

function listFolderFiles(folderId: string): FolderFile[] {
  const dir = path.resolve(DOCUMENTS_DIR, folderId);
  if (!dir.startsWith(path.resolve(DOCUMENTS_DIR))) return [];
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter(f => !f.startsWith('.'))
      .map(name => {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (!stat.isFile()) return null;
        return {
          name,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
          ext: path.extname(name).toLowerCase(),
        };
      })
      .filter((x): x is FolderFile => x !== null)
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch {
    return [];
  }
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function iconFor(ext: string) {
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) return ImageIcon;
  if (['.pdf', '.txt', '.md', '.csv', '.json', '.docx', '.xlsx'].includes(ext)) return FileText;
  if (['.zip', '.tar', '.gz', '.rar'].includes(ext)) return FileArchive;
  if (['.mp4', '.mov', '.avi', '.webm'].includes(ext)) return Video;
  if (['.mp3', '.wav', '.ogg', '.opus', '.m4a'].includes(ext)) return Music;
  return FileIcon;
}

export default async function FolderDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ uploaded?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const folders = await db.listDocumentFolders();
  const folder = folders.find(f => f.id === id);
  if (!folder) notFound();

  const files = listFolderFiles(id);
  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="max-w-[1200px] mx-auto">
      <Link href="/admin/documentos" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        ← Volver a documentos
      </Link>

      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <Folder className="w-10 h-10" style={{ color: folder.color }} />
          <div>
            <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">{folder.name}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {files.length} {files.length === 1 ? 'archivo' : 'archivos'} · {fmtSize(totalBytes)}
            </p>
            {folder.description && <p className="text-xs text-muted-foreground mt-1">{folder.description}</p>}
          </div>
        </div>
      </div>

      {sp.uploaded && (
        <div className="bg-[oklch(0.62_0.16_160_/_0.10)] border border-[oklch(0.62_0.16_160_/_0.30)] rounded-md px-3 py-2 mb-4 text-xs text-[var(--green)]">
          ✓ {sp.uploaded} archivo{Number(sp.uploaded) !== 1 ? 's' : ''} subido{Number(sp.uploaded) !== 1 ? 's' : ''}
        </div>
      )}

      {/* Upload form */}
      <Card className="p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Upload className="w-4 h-4 text-[var(--accent-strong)]" />
          <h2 className="text-[length:var(--h2-size)] font-semibold">Subir archivos</h2>
        </div>
        <form method="POST" action={`/api/admin/folders/${id}/upload`} encType="multipart/form-data" className="flex items-center gap-2 flex-wrap">
          <input type="file" name="files" multiple required
            className="flex-1 min-w-0 text-sm text-foreground file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[var(--accent)] file:text-primary-foreground file:cursor-pointer file:hover:opacity-90" />
          <Button type="submit" size="sm">Subir</Button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-2">Máximo 50MB por archivo. Filenames se sanitizan automáticamente.</p>
      </Card>

      {/* Files list */}
      {files.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Folder className="w-12 h-12 mx-auto text-muted-foreground mb-3" style={{ color: folder.color, opacity: 0.5 }} />
          <p className="text-sm text-muted-foreground">Carpeta vacía. Subí archivos arriba.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {files.map(f => {
              const Icon = iconFor(f.ext);
              const downloadUrl = `/api/admin/folders/${id}/files/${encodeURIComponent(f.name)}`;
              return (
                <li key={f.name} className="flex items-center gap-3 p-3 hover:bg-[var(--bg-inset)] transition-colors group">
                  <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <a href={downloadUrl} target="_blank" rel="noopener" className="flex-1 min-w-0 hover:underline">
                    <div className="text-sm text-foreground truncate">{f.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {fmtSize(f.size)} · {new Date(f.mtime).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </a>
                  <a href={downloadUrl} download={f.name} className="text-muted-foreground hover:text-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Descargar">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <form method="POST" action={`/api/admin/folders/${id}/files/${encodeURIComponent(f.name)}`}
                    onSubmit={e => { if (!confirm(`¿Borrar "${f.name}"?`)) e.preventDefault(); }}>
                    <input type="hidden" name="action" value="delete" />
                    <button type="submit" className="text-muted-foreground hover:text-[var(--red)] p-1 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Borrar">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
