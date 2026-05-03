'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar } from 'lucide-react';
import { PROJECT_STATUS, type ProjectStatus } from '@/lib/constants';
import { showToast } from '@/components/ui/toast';
import { timeAgo } from '@/lib/utils';
import type { Project } from '@/lib/db';

const VISIBLE: ProjectStatus[] = ['planning', 'in_progress', 'waiting_client', 'review', 'delivered'];

export function ProjectsKanban({ projects: initial }: { projects: Project[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initial);
  const cols = useRef<Map<string, HTMLDivElement>>(new Map());

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
  }, [router]);

  const byStatus = new Map<string, Project[]>();
  for (const s of VISIBLE) byStatus.set(s, []);
  for (const p of projects) {
    if (!byStatus.has(p.status)) byStatus.set(p.status, []);
    byStatus.get(p.status)!.push(p);
  }

  return (
    <div className="overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6 pb-4">
      <div className="flex gap-3 min-w-max">
        {VISIBLE.map(statusKey => {
          const def = PROJECT_STATUS.find(s => s.key === statusKey)!;
          const items = byStatus.get(statusKey) || [];
          return (
            <div key={statusKey} className="w-[300px] flex-shrink-0">
              <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: def.color, boxShadow: `0 0 8px ${def.color}` }}
                  />
                  <span className="text-[12px] font-semibold text-foreground">{def.label}</span>
                </div>
                <span
                  className="mono text-[10px] font-semibold text-muted-foreground rounded-full px-1.5 py-0.5"
                  style={{ background: 'color-mix(in oklch, var(--bg-inset) 80%, transparent)' }}
                >
                  {items.length}
                </span>
              </div>
              <div
                data-status={statusKey}
                ref={el => { if (el) cols.current.set(statusKey, el); }}
                className="bg-[var(--bg-inset)] rounded-[var(--r-md)] p-2 min-h-[400px] space-y-2 border border-dashed border-transparent hover:border-[var(--border-strong)] transition-colors"
              >
                {items.map(p => {
                  const tasks = p.tasks || [];
                  const totalTasks = tasks.length;
                  const doneTasks = tasks.filter(t => t.done).length;
                  const pct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;
                  const dl = p.deadline ? new Date(p.deadline) : null;
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  const overdue = dl && dl < today;
                  return (
                    <Link
                      key={p.id}
                      href={`/admin/projects/${p.id}`}
                      data-project-id={p.id}
                      className="block bg-card rounded-[var(--r-md)] p-3 cursor-grab active:cursor-grabbing border border-[var(--border)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] hover:border-[var(--border-strong)]"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <div
                          className="w-6 h-6 rounded grid place-items-center text-[10px] font-bold flex-shrink-0 text-white mt-px"
                          style={{ background: def.color }}
                        >
                          {(p.title || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium text-foreground line-clamp-2 leading-snug">{p.title || 'Sin título'}</div>
                          {p.client_name && <div className="text-[10px] text-muted-foreground truncate mt-0.5">{p.client_name}</div>}
                        </div>
                      </div>
                      {totalTasks > 0 && (
                        <div className="space-y-1 mb-2">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Tareas</span>
                            <span className="mono text-muted-foreground">{doneTasks}/{totalTasks} · {pct}%</span>
                          </div>
                          <div className="h-1 rounded-sm bg-[var(--bg-inset)] overflow-hidden">
                            <div className="h-full rounded-sm bg-[var(--accent)]" style={{ width: `${pct}%`, transition: 'width .8s ease' }} />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
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
                })}
                {items.length === 0 && (
                  <div className="text-center text-[10px] text-muted-foreground py-8 px-2">Arrastrá proyectos acá</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
