'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PROJECT_STATUS, type ProjectStatus } from '@/lib/constants';
import { showToast } from '@/components/ui/toast';
import { timeAgo } from '@/lib/utils';
import type { Project } from '@/lib/db';

const VISIBLE: ProjectStatus[] = ['planning', 'in_progress', 'waiting_client', 'review', 'delivered'];

export function ProjectsKanban({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const cols = useRef<Map<string, HTMLDivElement>>(new Map());

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
              if (d.ok) showToast('Estado actualizado', 'ok');
              else { showToast('Error', 'err'); router.refresh(); }
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
              <div className="flex items-center justify-between px-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: def.color, boxShadow: `0 0 6px ${def.color}` }} />
                  <span className="text-xs font-semibold text-foreground">{def.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground mono">{items.length}</span>
              </div>
              <div data-status={statusKey} ref={el => { if (el) cols.current.set(statusKey, el); }}
                className="bg-[var(--bg-inset)] rounded-lg p-2 min-h-[400px] space-y-2">
                {items.map(p => {
                  const tasks = (p.tasks || []) as { done?: boolean }[];
                  const totalTasks = tasks.length;
                  const doneTasks = tasks.filter(t => t.done).length;
                  const pct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;
                  return (
                    <Link key={p.id} href={`/admin/projects/${p.id}`} data-project-id={p.id}
                      className="block bg-card rounded-lg p-3 cursor-grab active:cursor-grabbing border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors">
                      <div className="text-xs font-medium text-foreground mb-1 line-clamp-2">{p.title || 'Sin título'}</div>
                      {p.client_name && <div className="text-[10px] text-muted-foreground mb-2 truncate">{p.client_name}</div>}
                      {totalTasks > 0 && (
                        <div className="space-y-1 mb-2">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Tareas</span>
                            <span className="mono text-muted-foreground">{doneTasks}/{totalTasks}</span>
                          </div>
                          <div className="h-1 rounded-full bg-[var(--bg-inset)] overflow-hidden">
                            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">{timeAgo(p.updated_at)}</span>
                        {p.deadline && <span className="text-[10px] text-[var(--amber)]">📅 {new Date(p.deadline).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</span>}
                      </div>
                    </Link>
                  );
                })}
                {items.length === 0 && (
                  <div className="text-center text-[10px] text-muted-foreground py-8">Arrastrá proyectos acá</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
