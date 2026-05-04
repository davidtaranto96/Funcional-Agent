'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Folder, Plus, Home, MessageCircle, FolderKanban, Search } from 'lucide-react';
import { confirmDialog } from '@/components/admin/ConfirmModal';
import type { FolderListing } from '@/lib/document-folders';

interface Stats {
  totalFiles: number;
  totalFolders: number;
  usedLabel: string;
  capLabel: string;
  usedPct: number;
}

interface Props {
  custom: FolderListing[];
  projects: FolderListing[];
  demos: FolderListing[];
  stats: Stats;
}

export function DocumentosView({ custom, projects, demos, stats }: Props) {
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState('');

  const all = useMemo(() => [...custom, ...projects, ...demos], [custom, projects, demos]);
  const filteredAll = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return all.filter(f => f.name.toLowerCase().includes(q) || f.subtitle.toLowerCase().includes(q));
  }, [all, query]);

  const filteredCustom = filteredAll ? filteredAll.filter(f => f.type === 'custom') : custom;
  const filteredProjects = filteredAll ? filteredAll.filter(f => f.type === 'project') : projects;
  const filteredDemos = filteredAll ? filteredAll.filter(f => f.type === 'demo') : demos;

  return (
    <div className="flex gap-4 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8">
      {/* Sidebar interna 220px */}
      <aside className="hidden md:flex w-[220px] flex-shrink-0 flex-col bg-card border border-[var(--border)] rounded-[var(--r-lg)] shadow-[var(--shadow-soft)] sticky top-5 self-start max-h-[calc(100vh-3rem)]">
        <div className="px-4 pt-4 pb-2.5 border-b border-[var(--border)]">
          <Link href="/admin/documentos" className="flex items-center gap-2 text-[12px] font-semibold text-foreground hover:text-[var(--accent-strong)] transition-colors">
            <Home className="w-3.5 h-3.5" /> Mi Drive
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2">
          <SidebarGroup label="Mis carpetas">
            {custom.length === 0 ? (
              <div className="text-[10px] text-muted-foreground px-2 py-1.5 italic">Sin carpetas</div>
            ) : (
              custom.map(f => (
                <SidebarItem key={f.id} f={f} icon={<Folder className="w-3 h-3 flex-shrink-0" style={{ color: f.color }} />} />
              ))
            )}
          </SidebarGroup>

          {projects.length > 0 && (
            <SidebarGroup label="Proyectos">
              {projects.map(p => (
                <SidebarItem key={p.id} f={p} icon={<span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.color }} />} />
              ))}
            </SidebarGroup>
          )}

          {demos.length > 0 && (
            <SidebarGroup label="Demos WA">
              {demos.map(d => (
                <SidebarItem
                  key={d.id}
                  f={d}
                  icon={
                    <span className="grid place-items-center w-4 h-4 rounded text-[8px] font-bold text-white bg-[var(--green)] flex-shrink-0">
                      {d.name.charAt(0).toUpperCase()}
                    </span>
                  }
                />
              ))}
            </SidebarGroup>
          )}
        </div>

        {/* Storage bar */}
        <div className="px-3.5 py-3 border-t border-[var(--border)]">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="mono uppercase tracking-wider text-muted-foreground font-semibold">Almacenamiento</span>
            <span className="mono text-muted-foreground">{stats.usedLabel}</span>
          </div>
          <div className="h-1 rounded-sm bg-[var(--bg-inset)] overflow-hidden mb-1.5">
            <div
              className="h-full rounded-sm bg-[var(--accent)]"
              style={{ width: `${Math.max(2, stats.usedPct)}%` }}
            />
          </div>
          <p className="mono text-[9px] text-muted-foreground">{stats.usedLabel} de {stats.capLabel}</p>
        </div>

        <div className="border-t border-[var(--border)] p-2.5">
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md bg-[var(--accent-dim)] text-[var(--accent-strong)] text-[12px] font-semibold hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva carpeta
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-foreground">Mi Drive</h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              <span className="mono">{stats.totalFiles}</span> archivos · <span className="mono">{stats.usedLabel}</span> usados
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="md:hidden flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
            style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Nueva carpeta
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5 max-w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar en todas las carpetas…"
            className="w-full h-9 pl-9 pr-3 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)] transition-colors"
          />
        </div>

        {/* New folder form */}
        {showNew && (
          <div className="bg-card border border-[var(--accent)] rounded-[var(--r-lg)] p-5 mb-5 shadow-[var(--shadow-soft)] pd-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-semibold text-foreground">Nueva carpeta</h2>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
            <form
              method="POST"
              action="/api/admin/folders/create"
              className="grid grid-cols-1 md:grid-cols-[1fr_80px_1fr_auto] gap-3 items-end"
            >
              <Field label="Nombre">
                <input name="name" required className={inputCls} placeholder="Ej. Contratos" />
              </Field>
              <Field label="Color">
                <input
                  name="color"
                  type="color"
                  defaultValue="#fbbf24"
                  className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--bg-input)] cursor-pointer"
                />
              </Field>
              <Field label="Descripción (opcional)">
                <input name="description" className={inputCls} />
              </Field>
              <button
                type="submit"
                className="h-9 px-4 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
                style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
              >
                <Plus className="inline w-3.5 h-3.5 mr-1" /> Crear
              </button>
            </form>
          </div>
        )}

        {/* Mis carpetas */}
        <Section title="Mis carpetas" icon={<Home className="w-3.5 h-3.5" />} count={filteredCustom.length}>
          {filteredCustom.length === 0 ? (
            <p className="text-[12px] text-muted-foreground px-1">
              {query ? 'Sin resultados.' : 'Sin carpetas todavía. Creá una desde el panel lateral.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredCustom.map(f => (
                <FolderCard key={f.id} f={f} deletable />
              ))}
            </div>
          )}
        </Section>

        {/* Proyectos con archivos */}
        {filteredProjects.length > 0 && (
          <Section title="Proyectos con archivos" icon={<FolderKanban className="w-3.5 h-3.5" />} count={filteredProjects.length}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProjects.map(p => (
                <FolderCard key={p.id} f={p} />
              ))}
            </div>
          </Section>
        )}

        {/* Demos WA */}
        {filteredDemos.length > 0 && (
          <Section title="Demos WA" icon={<MessageCircle className="w-3.5 h-3.5" />} count={filteredDemos.length}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredDemos.map(d => (
                <FolderCard key={d.id} f={d} />
              ))}
            </div>
          </Section>
        )}

        {/* Empty state global */}
        {custom.length === 0 && projects.length === 0 && demos.length === 0 && (
          <div className="bg-card border border-dashed border-[var(--border-strong)] rounded-[var(--r-lg)] p-10 text-center mt-5">
            <div className="inline-grid place-items-center w-12 h-12 rounded-xl bg-[var(--bg-inset)] mb-4">
              <Folder className="w-6 h-6 text-muted-foreground" />
            </div>
            <h2 className="text-[14px] font-semibold text-foreground mb-1">Drive vacío</h2>
            <p className="text-[12px] text-muted-foreground max-w-md mx-auto mb-3">
              Cuando crees una carpeta, demo o proyecto con archivos, va a aparecer acá.
            </p>
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Crear primera carpeta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarItem({ f, icon }: { f: FolderListing; icon: React.ReactNode }) {
  return (
    <Link
      href={f.href}
      className="flex items-center gap-2 px-2 h-7 rounded text-[12px] text-muted-foreground hover:text-foreground hover:bg-[var(--bg-inset)] transition-colors"
    >
      {icon}
      <span className="truncate flex-1">{f.name}</span>
      {f.fileCount > 0 && (
        <span className="mono text-[10px] opacity-70">{f.fileCount}</span>
      )}
    </Link>
  );
}

function SidebarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground px-2 mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function Section({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="grid place-items-center w-5 h-5 rounded bg-[var(--accent-dim)] text-[var(--accent-strong)]">
          {icon}
        </div>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h2>
        <span className="mono text-[10px] text-muted-foreground">{count}</span>
      </div>
      {children}
    </section>
  );
}

function FolderCard({ f, deletable }: { f: FolderListing; deletable?: boolean }) {
  const fileLabel = f.fileCount === 0 ? 'Vacía' : `${f.fileCount} archivo${f.fileCount === 1 ? '' : 's'}`;
  return (
    <div className="relative group">
      <Link
        href={f.href}
        className="flex items-start gap-2.5 bg-card border border-[var(--border)] rounded-[var(--r-lg)] p-3 transition-all hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft)]"
      >
        <Folder
          className="w-9 h-9 flex-shrink-0"
          style={{ color: f.color }}
          fill={f.color}
          fillOpacity={0.22}
          strokeWidth={1.4}
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="text-[12.5px] font-semibold text-foreground truncate" title={f.name}>{f.name}</div>
          <div className="mono text-[10px] text-muted-foreground mt-0.5">{fileLabel}</div>
          <div className="text-[10px] text-muted-foreground truncate mt-0.5" title={f.subtitle}>{f.subtitle}</div>
        </div>
      </Link>
      {deletable && (
        <form
          method="POST"
          action={`/api/admin/folders/${f.id}/delete`}
          className="absolute top-1.5 right-1.5"
        >
          <button
            type="submit"
            onClick={async e => {
              e.preventDefault();
              const ok = await confirmDialog({
                title: `¿Borrar "${f.name}"?`,
                description: f.fileCount > 0
                  ? `Esta carpeta tiene ${f.fileCount} archivo${f.fileCount === 1 ? '' : 's'}. Se borrarán también. Esta acción no se puede deshacer.`
                  : 'Esta acción no se puede deshacer.',
                confirmLabel: 'Sí, borrar',
                variant: 'danger',
              });
              if (ok) (e.currentTarget.closest('form') as HTMLFormElement)?.submit();
            }}
            className="grid place-items-center w-7 h-7 rounded-md bg-card/80 backdrop-blur border border-[var(--border)] text-muted-foreground hover:text-[var(--red)] hover:bg-[oklch(0.62_0.22_27_/_0.15)] hover:border-[var(--red)] transition-all opacity-60 group-hover:opacity-100"
            aria-label="Borrar carpeta"
            title="Borrar carpeta"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}

const inputCls = 'flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-3 text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)] transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}
