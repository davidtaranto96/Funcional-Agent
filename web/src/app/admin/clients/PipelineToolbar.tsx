'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { RefreshCcw, LayoutGrid, List, Archive, ArchiveRestore, Plus, ChevronDown, Globe, MessageCircle, Smartphone } from 'lucide-react';

type View = 'kanban' | 'list';
type Sort = 'recent' | 'oldest' | 'name' | 'stage';

interface Props {
  view: View;
  sort: Sort;
  showArchived: boolean;
  search: string;
  stage: string;
}

function buildHref(opts: Partial<Props>) {
  const params = new URLSearchParams();
  if (opts.view) params.set('view', opts.view);
  if (opts.sort && opts.sort !== 'recent') params.set('sort', opts.sort);
  if (opts.showArchived) params.set('archived', '1');
  if (opts.search) params.set('q', opts.search);
  if (opts.stage) params.set('stage', opts.stage);
  const q = params.toString();
  return `/admin/clients${q ? '?' + q : ''}`;
}

export function PipelineToolbar({ view, sort, showArchived, search, stage }: Props) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const demoRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    if (!demoOpen) return;
    function onClick(e: MouseEvent) {
      if (!demoRef.current?.contains(e.target as Node)) setDemoOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [demoOpen]);

  function refresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Refresh */}
      <button
        type="button"
        onClick={refresh}
        title="Actualizar"
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[var(--bg-card-2)] border border-[var(--border)] text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-[var(--bg-elevated)] transition-colors"
      >
        <RefreshCcw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        Actualizar
      </button>

      {/* Lista / Kanban */}
      <div className="flex items-center bg-[var(--bg-card-2)] border border-[var(--border)] rounded-md p-0.5">
        <Link
          href={buildHref({ view: 'list', sort, showArchived, search, stage })}
          className={`flex items-center gap-1.5 h-7 px-2.5 rounded text-[11px] font-medium transition-colors ${
            view === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <List className="w-3 h-3" /> Lista
        </Link>
        <Link
          href={buildHref({ view: 'kanban', sort, showArchived, search, stage })}
          className={`flex items-center gap-1.5 h-7 px-2.5 rounded text-[11px] font-medium transition-colors ${
            view === 'kanban' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <LayoutGrid className="w-3 h-3" /> Kanban
        </Link>
      </div>

      {/* Sort */}
      <select
        value={sort}
        onChange={e => router.push(buildHref({ view, sort: e.target.value as Sort, showArchived, search, stage }))}
        className="h-8 px-2.5 rounded-md bg-[var(--bg-card-2)] border border-[var(--border)] text-[11px] text-muted-foreground cursor-pointer outline-none hover:text-foreground"
      >
        <option value="recent">Más recientes</option>
        <option value="oldest">Más antiguos</option>
        <option value="name">Nombre A-Z</option>
        <option value="stage">Por etapa</option>
      </select>

      {/* Ver archivados */}
      <Link
        href={buildHref({ view, sort, showArchived: !showArchived, search, stage })}
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
          showArchived
            ? 'bg-[oklch(0.74_0.16_75_/_0.13)] border border-[oklch(0.74_0.16_75_/_0.30)] text-[var(--amber)]'
            : 'bg-[var(--bg-card-2)] border border-[var(--border)] text-muted-foreground hover:text-foreground'
        }`}
      >
        {showArchived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
        {showArchived ? 'Ver activos' : 'Ver archivados'}
      </Link>

      {/* Lead de prueba */}
      <div className="relative" ref={demoRef}>
        <button
          type="button"
          onClick={() => setDemoOpen(o => !o)}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-dashed border-[var(--border-strong)] text-[11px] font-medium text-muted-foreground hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
        >
          <Plus className="w-3 h-3" /> Lead de prueba <ChevronDown className={`w-2.5 h-2.5 transition-transform ${demoOpen ? 'rotate-180' : ''}`} />
        </button>
        {demoOpen && (
          <div className="absolute right-0 top-full mt-1 bg-card border border-[var(--border-strong)] rounded-[var(--r-md)] shadow-[var(--shadow-elev)] z-20 w-[220px] py-1.5 pd-fade-in">
            <div className="px-3 py-1 mono text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
              Tipo de demo
            </div>
            <DemoOption tipo="web" label="Web — Panadería"            Icon={Globe}        color="oklch(0.62 0.20 250)" />
            <DemoOption tipo="bot" label="Bot WA — Veterinaria"        Icon={MessageCircle} color="oklch(0.62 0.16 160)" />
            <DemoOption tipo="app" label="App móvil — Gimnasio"        Icon={Smartphone}   color="oklch(0.62 0.18 290)" />
          </div>
        )}
      </div>
    </div>
  );
}

function DemoOption({ tipo, label, Icon, color }: { tipo: string; label: string; Icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <form method="POST" action="/api/admin/clients/create-demo-lead">
      <input type="hidden" name="tipo" value={tipo} />
      <button
        type="submit"
        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-foreground hover:bg-[var(--bg-inset)] transition-colors text-left"
      >
        <span
          className="grid place-items-center w-6 h-6 rounded"
          style={{ background: `color-mix(in oklch, ${color} 14%, transparent)`, color }}
        >
          <Icon className="w-3 h-3" />
        </span>
        {label}
      </button>
    </form>
  );
}
