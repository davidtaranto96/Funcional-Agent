'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, Maximize2, Minimize2, EyeOff, Archive } from 'lucide-react';
import { PROJECT_STATUS, type ProjectStatus } from '@/lib/constants';
import { showToast } from '@/components/ui/toast';
import { timeAgo } from '@/lib/utils';
import type { Project } from '@/lib/db';

const VISIBLE_FULL: ProjectStatus[] = ['planning', 'in_progress', 'waiting_client', 'review', 'delivered'];
const VISIBLE_ACTIVE: ProjectStatus[] = ['planning', 'in_progress', 'waiting_client', 'review'];

export function ProjectsKanban({ projects: initial }: { projects: Project[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initial);
  const cols = useRef<Map<string, HTMLDivElement>>(new Map());

  // Display preferences (persisted en localStorage)
  const [compact, setCompact] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [hideDelivered, setHideDelivered] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = JSON.parse(localStorage.getItem('pd-projects-kanban-prefs') || '{}');
      if (typeof saved.compact === 'boolean') setCompact(saved.compact);
      if (typeof saved.hideEmpty === 'boolean') setHideEmpty(saved.hideEmpty);
      if (typeof saved.hideDelivered === 'boolean') setHideDelivered(saved.hideDelivered);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('pd-projects-kanban-prefs', JSON.stringify({ compact, hideEmpty, hideDelivered }));
  }, [compact, hideEmpty, hideDelivered]);

  useEffect(() => { setProjects(initial); }, [initial]);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    (async () => {
      const Sortable = (await import('sortablejs')).default;
      const insts: Array<ReturnType<typeof Sortable.create>> = [];
      cols.current.forEach(el => {
        const inst = Sortable.create(el, {
          group: 'projects',
          animation: 200,
          ghostClass: 'opacity-40',
          dragClass: 'rotate-2',
          onEnd: async evt => {
            const card = evt.item;
            const newStatus = (evt.to as HTMLElement).dataset.status;
            const projectId = card.dataset.projectId;
            if (!projectId || !newStatus || newStatus === evt.from.dataset.status) return;
            try {
              const r = await fetch('/api/admin/project-status', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, newStatus }),
              });
              const d = await r.json();
              if (d.ok) {
                showToast('Estado actualizado', 'ok');
                setProjects(ps => ps.map(p => p.id === projectId ? { ...p, status: newStatus } : p));
              } else { showToast('Error', 'err'); router.refresh(); }
            } catch { showToast('Error de red', 'err'); router.refresh(); }
          },
        });
        insts.push(inst);
      });
      cleanup = () => insts.forEach(i => i.destroy());
    })();
    return () => { cleanup?.(); };
  }, [router, hideEmpty, hideDelivered, compact]);

  const visibleStatuses = useMemo<ProjectStatus[]>(() => {
    return hideDelivered ? VISIBLE_ACTIVE : VISIBLE_FULL;
  }, [hideDelivered]);

  const byStatus = useMemo(() => {
    const m = new Map<string, Project[]>();
    for (const s of visibleStatuses) m.set(s, []);
    for (const p of projects) {
      if (!visibleStatuses.includes(p.status as ProjectStatus)) continue;
      if (!m.has(p.status)) m.set(p.status, []);
      m.get(p.status)!.push(p);
    }
    return m;
  }, [projects, visibleStatuses]);

  return (
    <>
      {/* Toggles bar */}
      <div className="flex items-center gap-1 mb-3 justify-end">
        <KanbanToggle
          active={compact}
          onClick={() => setCompact(c => !c)}
          icon={compact ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          title={compact ? 'Vista cómoda' : 'Vista compacta'}
        />
        <KanbanToggle
          active={hideEmpty}
          onClick={() => setHideEmpty(c => !c)}
          icon={<EyeOff className="w-3 h-3" />}
          title={hideEmpty ? 'Mostrar columnas vacías' : 'Esconder columnas vacías'}
        />
        <KanbanToggle
          active={hideDelivered}
          onClick={() => setHideDelivered(c => !c)}
          icon={<Archive className="w-3 h-3" />}
          title={hideDelivered ? 'Mostrar Entregados' : 'Esconder Entregados'}
        />
      </div>

      <div className="overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6 pb-4 snap-x snap-mandatory md:snap-none scroll-smooth">
        <div className="flex gap-2 min-w-max">
          {visibleStatuses.map(statusKey => {
            const def = PROJECT_STATUS.find(s => s.key === statusKey)!;
            const items = byStatus.get(statusKey) || [];
            const isEmpty = items.length === 0;

            // Columna colapsada (vacía + hideEmpty ON)
            if (hideEmpty && isEmpty) {
              return (
                <div key={statusKey} className="w-[40px] flex-shrink-0">
                  <div className="flex flex-col items-center gap-2 px-1 mb-2 h-[28px] justify-center">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: def.color }} />
                  </div>
                  <div
                    data-status={statusKey}
                    ref={el => { if (el) cols.current.set(statusKey, el); }}
                    className="bg-[var(--bg-inset)] rounded-[var(--r-md)] min-h-[400px] flex items-start justify-center pt-4 border border-dashed border-transparent hover:border-[var(--border-strong)] transition-colors"
                    title={`${def.label} (vacía) — arrastrá acá para mover`}
                  >
                    <span
                      className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                    >
                      {def.label}
                    </span>
                  </div>
                </div>
              );
            }

            // Width responsive: en mobile ~85vw para que entre 1 columna visible con peek de la siguiente
            const colWidth = compact
              ? 'w-[85vw] sm:w-[240px] md:w-[230px]'
              : 'w-[88vw] sm:w-[280px] md:w-[300px]';

            return (
              <div key={statusKey} className={`${colWidth} flex-shrink-0 snap-start md:snap-align-none`}>
                <div className="flex items-center justify-between px-1 mb-2 h-[28px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: def.color, boxShadow: `0 0 8px ${def.color}` }}
                    />
                    <span className="text-[12px] font-semibold text-foreground truncate">{def.label}</span>
                  </div>
                  <span
                    className="mono text-[10px] font-semibold text-muted-foreground rounded-full px-1.5 py-0.5 flex-shrink-0"
                    style={{ background: 'color-mix(in oklch, var(--bg-inset) 80%, transparent)' }}
                  >
                    {items.length}
                  </span>
                </div>
                <div
                  data-status={statusKey}
                  ref={el => { if (el) cols.current.set(statusKey, el); }}
                  className={`bg-[var(--bg-inset)] rounded-[var(--r-md)] ${compact ? 'p-1.5 space-y-1.5' : 'p-2 space-y-2'} min-h-[400px] border border-dashed border-transparent hover:border-[var(--border-strong)] transition-colors`}
                >
                  {items.map(p => (
                    <ProjectCard key={p.id} project={p} statusColor={def.color} compact={compact} />
                  ))}
                  {items.length === 0 && (
                    <div className="text-center text-[10px] text-muted-foreground py-8 px-2">Arrastrá acá</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function KanbanToggle({ active, onClick, icon, title }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`grid place-items-center w-7 h-7 rounded-md border transition-colors ${
        active
          ? 'bg-[var(--accent-dim)] border-[color-mix(in_oklch,var(--accent)_30%,transparent)] text-[var(--accent-strong)]'
          : 'bg-[var(--bg-card-2)] border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
    </button>
  );
}

function ProjectCard({ project: p, statusColor, compact }: {
  project: Project;
  statusColor: string;
  compact: boolean;
}) {
  const tasks = p.tasks || [];
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.done).length;
  const pct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;
  const dl = p.deadline ? new Date(p.deadline) : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = dl && dl < today;
  const initial = (p.title || '?').charAt(0).toUpperCase();

  // COMPACT: 1-2 lineas con barrita de progreso fina
  if (compact) {
    return (
      <Link
        href={`/admin/projects/${p.id}`}
        data-project-id={p.id}
        className="block bg-card rounded-[var(--r-md)] px-2.5 py-2 cursor-grab active:cursor-grabbing border border-[var(--border)] transition-all hover:shadow-[var(--shadow-soft)] hover:border-[var(--border-strong)]"
      >
        <div className="flex items-center gap-1.5 min-w-0 mb-1">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusColor }} />
          <span className="text-[12px] font-medium text-foreground truncate flex-1">{p.title || 'Sin título'}</span>
          {totalTasks > 0 && (
            <span className="mono text-[9px] text-muted-foreground flex-shrink-0">{doneTasks}/{totalTasks}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 pl-3.5">
          <span className="text-[10px] text-muted-foreground truncate flex-1">{p.client_name || timeAgo(p.updated_at)}</span>
          {dl && (
            <span
              className="mono text-[9px] inline-flex items-center gap-0.5 flex-shrink-0"
              style={{ color: overdue ? 'oklch(0.62 0.22 27)' : 'var(--text-3)' }}
            >
              <Calendar className="w-2.5 h-2.5" />
              {dl.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>
        {totalTasks > 0 && (
          <div className="h-0.5 rounded-sm bg-[var(--bg-inset)] overflow-hidden mt-1.5">
            <div className="h-full rounded-sm bg-[var(--accent)]" style={{ width: `${pct}%`, transition: 'width .6s ease' }} />
          </div>
        )}
      </Link>
    );
  }

  // CÓMODO: layout completo
  return (
    <Link
      href={`/admin/projects/${p.id}`}
      data-project-id={p.id}
      className="block bg-card rounded-[var(--r-md)] p-2.5 cursor-grab active:cursor-grabbing border border-[var(--border)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] hover:border-[var(--border-strong)]"
    >
      <div className="flex items-start gap-2 mb-2">
        <div
          className="w-6 h-6 rounded grid place-items-center text-[10px] font-bold flex-shrink-0 text-white mt-px"
          style={{ background: statusColor }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-foreground line-clamp-2 leading-snug">{p.title || 'Sin título'}</div>
          {p.client_name && <div className="text-[10px] text-muted-foreground truncate mt-0.5">{p.client_name}</div>}
        </div>
      </div>
      {totalTasks > 0 && (
        <div className="space-y-1 mb-2 pl-8">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Tareas</span>
            <span className="mono text-muted-foreground">{doneTasks}/{totalTasks} · {pct}%</span>
          </div>
          <div className="h-1 rounded-sm bg-[var(--bg-inset)] overflow-hidden">
            <div className="h-full rounded-sm bg-[var(--accent)]" style={{ width: `${pct}%`, transition: 'width .8s ease' }} />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mt-2 pl-8">
        <span className="text-[10px] text-muted-foreground">{timeAgo(p.updated_at)}</span>
        {dl && (
          <span
            className="mono text-[10px] inline-flex items-center gap-1"
            style={{ color: overdue ? 'oklch(0.62 0.22 27)' : 'var(--text-3)' }}
          >
            <Calendar className="w-2.5 h-2.5" />
            {dl.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>
    </Link>
  );
}
