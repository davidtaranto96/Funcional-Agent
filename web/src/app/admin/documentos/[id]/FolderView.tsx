'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Folder, FileText, Image as ImageIcon, FileArchive, Video, Music, File as FileIcon,
  Download, Trash2, Edit3, FolderInput, Upload, X, ChevronRight, Search,
  LayoutGrid, List as ListIcon, MoreHorizontal, ExternalLink, Check,
} from 'lucide-react';
import { confirmDialog } from '@/components/admin/ConfirmModal';
import { showToast } from '@/components/ui/toast';

export interface FolderFile { name: string; size: number; mtime: string; ext: string }
export interface FolderInfo { id: string; name: string; color: string; description?: string; type?: 'custom' | 'project' | 'demo'; subtitle?: string }
export interface OtherFolder { id: string; name: string; color: string; type?: 'custom' | 'project' | 'demo' }

interface Props {
  folder: FolderInfo;
  files: FolderFile[];
  otherFolders: OtherFolder[];
}

type ViewMode = 'grid' | 'list';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function iconFor(ext: string) {
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) return ImageIcon;
  if (['.pdf', '.txt', '.md', '.csv', '.json', '.docx', '.xlsx', '.html'].includes(ext)) return FileText;
  if (['.zip', '.tar', '.gz', '.rar'].includes(ext)) return FileArchive;
  if (['.mp4', '.mov', '.avi', '.webm'].includes(ext)) return Video;
  if (['.mp3', '.wav', '.ogg', '.opus', '.m4a'].includes(ext)) return Music;
  return FileIcon;
}

function colorFor(ext: string): string {
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) return 'oklch(0.62 0.18 290)';
  if (ext === '.pdf') return 'oklch(0.62 0.22 27)';
  if (['.html', '.htm'].includes(ext)) return 'oklch(0.62 0.18 250)';
  if (['.md', '.txt'].includes(ext)) return 'oklch(0.62 0.16 200)';
  if (['.docx', '.doc'].includes(ext)) return 'oklch(0.62 0.18 250)';
  if (['.xlsx', '.csv'].includes(ext)) return 'oklch(0.62 0.16 160)';
  if (['.zip', '.tar', '.gz', '.rar'].includes(ext)) return 'oklch(0.74 0.16 75)';
  if (['.mp4', '.mov', '.avi', '.webm'].includes(ext)) return 'oklch(0.62 0.18 290)';
  if (['.mp3', '.wav', '.ogg', '.opus', '.m4a'].includes(ext)) return 'oklch(0.62 0.20 250)';
  return 'oklch(0.5 0.05 250)';
}

export function FolderView({ folder, files: initialFiles, otherFolders }: Props) {
  const router = useRouter();
  const [files, setFiles] = useState<FolderFile[]>(initialFiles);
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'grid';
    return (localStorage.getItem('docs-view') as ViewMode) || 'grid';
  });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastSelected, setLastSelected] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [moveOpen, setMoveOpen] = useState<string[] | null>(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: string } | null>(null);
  const [dropping, setDropping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistir view preference
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('docs-view', view);
  }, [view]);

  // Cerrar context menu al click fuera o escape
  useEffect(() => {
    if (!contextMenu) return;
    function close() { setContextMenu(null); }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setContextMenu(null); }
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  // Atajos teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Skip if typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && files.length > 0) {
        e.preventDefault();
        setSelected(new Set(filtered.map(f => f.name)));
      } else if (e.key === 'Delete' && selected.size > 0) {
        e.preventDefault();
        bulkDelete();
      } else if (e.key === 'Escape') {
        setSelected(new Set());
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, files]);

  const filtered = useMemo(() => {
    if (!query.trim()) return files;
    const q = query.toLowerCase();
    return files.filter(f => f.name.toLowerCase().includes(q));
  }, [files, query]);

  const totalBytes = useMemo(() => filtered.reduce((acc, f) => acc + f.size, 0), [filtered]);

  function handleFileClick(name: string, e: React.MouseEvent) {
    if (e.shiftKey && lastSelected) {
      const idx1 = filtered.findIndex(f => f.name === lastSelected);
      const idx2 = filtered.findIndex(f => f.name === name);
      const [a, b] = idx1 < idx2 ? [idx1, idx2] : [idx2, idx1];
      const next = new Set(selected);
      filtered.slice(a, b + 1).forEach(f => next.add(f.name));
      setSelected(next);
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selected);
      if (next.has(name)) next.delete(name); else next.add(name);
      setSelected(next);
      setLastSelected(name);
    } else {
      setSelected(new Set([name]));
      setLastSelected(name);
    }
  }

  function openContextMenu(e: React.MouseEvent, name: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!selected.has(name)) {
      setSelected(new Set([name]));
      setLastSelected(name);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, file: name });
  }

  function downloadUrl(name: string) {
    return `/api/admin/folders/${folder.id}/files/${encodeURIComponent(name)}`;
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of arr) fd.append('files', f);
      const res = await fetch(`/api/admin/folders/${folder.id}/upload-ajax`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falló la subida');
      showToast(`${data.saved} archivo${data.saved === 1 ? '' : 's'} subido${data.saved === 1 ? '' : 's'}`, 'ok');
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al subir';
      showToast(msg, 'err');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function deleteFile(name: string) {
    const ok = await confirmDialog({
      title: `¿Borrar "${name}"?`,
      description: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Sí, borrar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const fd = new FormData();
      fd.append('action', 'delete');
      const res = await fetch(`/api/admin/folders/${folder.id}/files/${encodeURIComponent(name)}`, {
        method: 'POST', body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Error');
      setFiles(fs => fs.filter(f => f.name !== name));
      setSelected(prev => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
      showToast('Archivo borrado', 'ok');
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo borrar';
      showToast(msg, 'err');
    }
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    const names = Array.from(selected);
    const ok = await confirmDialog({
      title: `¿Borrar ${names.length} archivo${names.length === 1 ? '' : 's'}?`,
      description: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Sí, borrar',
      variant: 'danger',
    });
    if (!ok) return;
    let success = 0;
    const failed: string[] = [];
    const deleted: string[] = [];
    for (const name of names) {
      try {
        const fd = new FormData();
        fd.append('action', 'delete');
        const res = await fetch(`/api/admin/folders/${folder.id}/files/${encodeURIComponent(name)}`, {
          method: 'POST', body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) {
          success++;
          deleted.push(name);
        } else {
          failed.push(`${name}: ${data?.error || 'error'}`);
        }
      } catch (err) {
        failed.push(`${name}: ${err instanceof Error ? err.message : 'error'}`);
      }
    }
    // Solo sacamos del estado local los que SI se borraron
    setFiles(fs => fs.filter(f => !deleted.includes(f.name)));
    setSelected(new Set());
    if (failed.length > 0) {
      console.error('[bulkDelete] failed:', failed);
      showToast(`${success} borrados, ${failed.length} fallaron — revisá la consola`, 'err');
    } else {
      showToast(`${success} archivo${success === 1 ? '' : 's'} borrado${success === 1 ? '' : 's'}`, 'ok');
    }
    router.refresh();
  }

  async function doRename() {
    if (!renameOpen || !renameValue.trim()) return;
    const oldName = renameOpen;
    const newName = renameValue.trim();
    if (newName === oldName) { setRenameOpen(null); return; }
    try {
      const fd = new FormData();
      fd.append('newName', newName);
      const res = await fetch(`/api/admin/folders/${folder.id}/files/${encodeURIComponent(oldName)}/rename`, {
        method: 'POST', body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falló');
      setFiles(fs => fs.map(f => f.name === oldName ? { ...f, name: data.name, ext: data.ext } : f));
      setRenameOpen(null);
      setRenameValue('');
      showToast('Renombrado', 'ok');
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      showToast(msg, 'err');
    }
  }

  async function doMove() {
    if (!moveOpen || !moveTarget) return;
    const names = moveOpen;
    let success = 0;
    for (const name of names) {
      try {
        const fd = new FormData();
        fd.append('toFolder', moveTarget);
        const res = await fetch(`/api/admin/folders/${folder.id}/files/${encodeURIComponent(name)}/move`, {
          method: 'POST', body: fd,
        });
        if (res.ok) success++;
      } catch { /* skip */ }
    }
    setFiles(fs => fs.filter(f => !names.includes(f.name)));
    setMoveOpen(null);
    setMoveTarget('');
    setSelected(new Set());
    const targetFolder = otherFolders.find(o => o.id === moveTarget);
    showToast(`${success} archivo${success === 1 ? '' : 's'} movido${success === 1 ? '' : 's'} a ${targetFolder?.name || 'carpeta'}`, 'ok');
    router.refresh();
  }

  // Drag & drop
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (Array.from(e.dataTransfer.types).includes('Files')) setDropping(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setDropping(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDropping(false);
    const dropped = e.dataTransfer.files;
    if (dropped && dropped.length > 0) uploadFiles(dropped);
  }

  return (
    <div
      className="max-w-[1200px] mx-auto relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drop overlay */}
      {dropping && (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-[oklch(0.62_0.18_250_/_0.10)] backdrop-blur-sm pointer-events-none border-4 border-dashed border-[var(--accent)]">
          <div className="bg-card rounded-[var(--r-lg)] p-8 shadow-[var(--shadow-elev)] border-2 border-[var(--accent)] text-center">
            <Upload className="w-10 h-10 mx-auto text-[var(--accent)] mb-3" />
            <div className="text-[16px] font-bold text-foreground">Soltá archivos para subirlos</div>
            <div className="text-[12px] text-muted-foreground mt-1">a {folder.name}</div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-3">
        <Link href="/admin/documentos" className="hover:text-foreground transition-colors flex items-center gap-1">
          <Folder className="w-3 h-3" /> Mi Drive
        </Link>
        <ChevronRight className="w-3 h-3" />
        {folder.type === 'project' && <span className="text-muted-foreground">Proyectos</span>}
        {folder.type === 'demo' && <span className="text-muted-foreground">Demos WA</span>}
        {(folder.type === 'project' || folder.type === 'demo') && <ChevronRight className="w-3 h-3" />}
        <span className="text-foreground font-medium">{folder.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <Folder
            className="w-10 h-10 flex-shrink-0"
            style={{ color: folder.color }}
            fill={folder.color}
            fillOpacity={0.22}
            strokeWidth={1.4}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[20px] font-bold tracking-tight text-foreground truncate">{folder.name}</h1>
              {folder.type === 'project' && (
                <span className="text-[9px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 bg-[oklch(0.62_0.18_290_/_0.14)] text-[oklch(0.62_0.18_290)]">
                  Proyecto
                </span>
              )}
              {folder.type === 'demo' && (
                <span className="text-[9px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 bg-[oklch(0.62_0.16_160_/_0.14)] text-[var(--green)]">
                  Demo WA
                </span>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              <span className="mono">{filtered.length}</span> {filtered.length === 1 ? 'archivo' : 'archivos'} · <span className="mono">{fmtSize(totalBytes)}</span>
              {query && (
                <>
                  {' · '}
                  <span className="text-[var(--accent-strong)]">filtrado de {files.length}</span>
                </>
              )}
            </p>
            {folder.subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{folder.subtitle}</p>}
            {folder.description && <p className="text-[11px] text-muted-foreground mt-1 max-w-[480px]">{folder.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all disabled:opacity-60"
            style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Subiendo…' : 'Subir archivos'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => e.target.files && uploadFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar archivos…"
            className="w-full h-9 pl-9 pr-3 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)] transition-colors"
          />
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-[var(--bg-card-2)] border border-[var(--border)] rounded-md p-0.5">
          <button
            type="button"
            onClick={() => setView('grid')}
            aria-pressed={view === 'grid'}
            title="Vista en cuadrícula"
            className={`grid place-items-center h-7 w-7 rounded transition-colors ${view === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            aria-pressed={view === 'list'}
            title="Vista en lista"
            className={`grid place-items-center h-7 w-7 rounded transition-colors ${view === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <ListIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-1.5 bg-[var(--accent-dim)] border border-[var(--accent)] rounded-md px-2 py-1 pd-fade-in">
            <span className="mono text-[11px] font-semibold text-[var(--accent-strong)]">
              {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => setMoveOpen(Array.from(selected))}
              disabled={otherFolders.length === 0}
              className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium text-foreground hover:bg-card transition-colors disabled:opacity-40"
              title="Mover a otra carpeta"
            >
              <FolderInput className="w-3 h-3" /> Mover
            </button>
            <button
              type="button"
              onClick={bulkDelete}
              className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium text-[var(--red)] hover:bg-[oklch(0.62_0.22_27_/_0.10)] transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Borrar
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="grid place-items-center w-5 h-5 rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Deseleccionar"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Files */}
      {filtered.length === 0 ? (
        <div
          className="bg-card border-2 border-dashed border-[var(--border-strong)] rounded-[var(--r-lg)] p-16 text-center"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-60" />
          <p className="text-[13px] text-foreground font-medium">
            {query ? 'Sin resultados con esos filtros.' : 'Carpeta vacía'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {query ? 'Probá con otra búsqueda.' : 'Arrastrá archivos acá o hacé click para subirlos.'}
          </p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(f => (
            <FileCard
              key={f.name}
              file={f}
              folderId={folder.id}
              selected={selected.has(f.name)}
              onClick={(e) => handleFileClick(f.name, e)}
              onContextMenu={(e) => openContextMenu(e, f.name)}
              onDoubleClick={() => window.open(downloadUrl(f.name), '_blank')}
            />
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] overflow-hidden shadow-[var(--shadow-soft)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nombre</th>
                <th className="text-right px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-24">Tamaño</th>
                <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-40">Modificado</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => {
                const Icon = iconFor(f.ext);
                const isSel = selected.has(f.name);
                return (
                  <tr
                    key={f.name}
                    onClick={(e) => handleFileClick(f.name, e)}
                    onDoubleClick={() => window.open(downloadUrl(f.name), '_blank')}
                    onContextMenu={(e) => openContextMenu(e, f.name)}
                    className={`border-b border-[var(--border)] last:border-0 cursor-pointer transition-colors ${isSel ? 'bg-[var(--accent-dim)]' : 'hover:bg-[var(--bg-inset)]'}`}
                  >
                    <td className="px-4 py-2 flex items-center gap-2.5">
                      <div
                        className="grid place-items-center w-7 h-7 rounded-md flex-shrink-0"
                        style={{ background: `color-mix(in oklch, ${colorFor(f.ext)} 14%, transparent)` }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: colorFor(f.ext) }} />
                      </div>
                      <span className="text-[12px] text-foreground truncate">{f.name}</span>
                    </td>
                    <td className="px-4 py-2 text-right mono text-[11px] text-muted-foreground">{fmtSize(f.size)}</td>
                    <td className="px-4 py-2 text-[11px] text-muted-foreground">
                      {new Date(f.mtime).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openContextMenu(e, f.name); }}
                        className="grid place-items-center w-6 h-6 rounded text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                        aria-label="Acciones"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Hint footer */}
      <p className="mt-4 text-[10px] text-muted-foreground italic">
        Arrastrá archivos para subir · click derecho para acciones · Ctrl+Click selecciona varios · Delete borra · Ctrl+A todos
      </p>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-[400] bg-card border border-[var(--border-strong)] rounded-md shadow-[var(--shadow-elev)] py-1 min-w-[180px] pd-fade-in"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 280) }}
          onClick={(e) => e.stopPropagation()}
        >
          <CtxItem
            icon={<ExternalLink className="w-3.5 h-3.5" />}
            label="Abrir / Descargar"
            onClick={() => { window.open(downloadUrl(contextMenu.file), '_blank'); setContextMenu(null); }}
          />
          <a
            href={downloadUrl(contextMenu.file)}
            download={contextMenu.file}
            onClick={() => setContextMenu(null)}
            className="flex items-center gap-2 px-3 h-8 text-[12px] text-foreground hover:bg-[var(--bg-inset)] cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" /> Forzar descarga
          </a>
          <CtxItem
            icon={<Edit3 className="w-3.5 h-3.5" />}
            label="Renombrar"
            onClick={() => {
              setRenameOpen(contextMenu.file);
              setRenameValue(contextMenu.file);
              setContextMenu(null);
            }}
          />
          {otherFolders.length > 0 && (
            <CtxItem
              icon={<FolderInput className="w-3.5 h-3.5" />}
              label={selected.size > 1 ? `Mover ${selected.size} archivos…` : 'Mover a…'}
              onClick={() => {
                setMoveOpen(selected.size > 1 ? Array.from(selected) : [contextMenu.file]);
                setContextMenu(null);
              }}
            />
          )}
          <div className="border-t border-[var(--border)] my-1" />
          <CtxItem
            icon={<Trash2 className="w-3.5 h-3.5" />}
            label={selected.size > 1 ? `Borrar ${selected.size} archivos` : 'Borrar'}
            danger
            onClick={() => {
              if (selected.size > 1) bulkDelete();
              else deleteFile(contextMenu.file);
              setContextMenu(null);
            }}
          />
        </div>
      )}

      {/* Rename modal */}
      {renameOpen && (
        <div
          className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm grid place-items-center p-4 pd-fade-in"
          onClick={() => setRenameOpen(null)}
        >
          <div
            className="bg-card border border-[var(--border-strong)] rounded-[var(--r-lg)] shadow-[var(--shadow-elev)] p-5 w-[420px] max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[14px] font-semibold text-foreground mb-3">Renombrar archivo</h3>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') doRename();
                if (e.key === 'Escape') setRenameOpen(null);
              }}
              className="w-full h-9 px-3 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-[12px] text-foreground outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)]"
            />
            <p className="text-[10px] text-muted-foreground mt-2">Conservá la extensión (ej. <code className="mono">.pdf</code>) o el archivo perderá su tipo.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setRenameOpen(null)}
                className="h-8 px-3 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-[var(--bg-inset)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={doRename}
                className="flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
              >
                <Check className="w-3.5 h-3.5" /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move modal */}
      {moveOpen && (
        <div
          className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm grid place-items-center p-4 pd-fade-in"
          onClick={() => setMoveOpen(null)}
        >
          <div
            className="bg-card border border-[var(--border-strong)] rounded-[var(--r-lg)] shadow-[var(--shadow-elev)] p-5 w-[460px] max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[14px] font-semibold text-foreground mb-1">
              Mover {moveOpen.length} archivo{moveOpen.length === 1 ? '' : 's'}
            </h3>
            <p className="text-[11px] text-muted-foreground mb-3">Elegí carpeta destino:</p>
            <div className="max-h-[280px] overflow-y-auto -mx-1">
              {otherFolders.map(of => (
                <button
                  key={of.id}
                  type="button"
                  onClick={() => setMoveTarget(of.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors ${moveTarget === of.id ? 'bg-[var(--accent-dim)] border border-[var(--accent)]' : 'hover:bg-[var(--bg-inset)] border border-transparent'}`}
                >
                  <Folder className="w-4 h-4 flex-shrink-0" style={{ color: of.color }} fill={of.color} fillOpacity={0.2} />
                  <span className="text-[12px] text-foreground truncate flex-1">{of.name}</span>
                  {moveTarget === of.id && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setMoveOpen(null)}
                className="h-8 px-3 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-[var(--bg-inset)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={doMove}
                disabled={!moveTarget}
                className="flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FolderInput className="w-3.5 h-3.5" /> Mover acá
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CtxItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 h-8 text-[12px] text-left transition-colors ${danger ? 'text-[var(--red)] hover:bg-[oklch(0.62_0.22_27_/_0.10)]' : 'text-foreground hover:bg-[var(--bg-inset)]'}`}
    >
      <span className={danger ? 'text-[var(--red)]' : 'text-muted-foreground'}>{icon}</span>
      {label}
    </button>
  );
}

function FileCard({
  file, folderId, selected, onClick, onContextMenu, onDoubleClick,
}: {
  file: FolderFile;
  folderId: string;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}) {
  const Icon = iconFor(file.ext);
  const color = colorFor(file.ext);
  const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(file.ext);

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      tabIndex={0}
      role="button"
      className={`relative bg-card rounded-[var(--r-lg)] overflow-hidden cursor-pointer transition-all border-2 ${selected ? 'border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-dim)]' : 'border-[var(--border)] hover:border-[var(--border-strong)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]'}`}
    >
      {/* Preview area */}
      <div
        className="relative h-[110px] grid place-items-center overflow-hidden"
        style={{ background: `color-mix(in oklch, ${color} 8%, var(--bg-inset))` }}
      >
        {isImage ? (
          <img
            src={`/api/admin/folders/${folderId}/files/${encodeURIComponent(file.name)}`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Icon className="w-12 h-12" style={{ color, opacity: 0.85 }} strokeWidth={1.4} />
        )}
        <span
          className="absolute top-1.5 right-1.5 mono text-[8px] font-bold px-1.5 py-0.5 rounded uppercase text-white"
          style={{ background: color }}
        >
          {file.ext.replace('.', '') || 'file'}
        </span>
      </div>
      {/* Body */}
      <div className="px-3 py-2.5">
        <div className="text-[11.5px] font-medium text-foreground truncate" title={file.name}>{file.name}</div>
        <div className="mono text-[9px] text-muted-foreground mt-0.5 flex items-center justify-between">
          <span>{fmtSize(file.size)}</span>
          <span>{new Date(file.mtime).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
        </div>
      </div>
    </div>
  );
}
