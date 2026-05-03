'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TASK_STATUS, type TaskStatusKey } from '@/lib/constants';
import { showToast } from '@/components/ui/toast';

export interface TaskWithMeta {
  text: string;
  done: boolean;
  status?: TaskStatusKey;
  priority?: 'high' | 'medium' | 'low';
  assignee?: 'david' | 'hermana' | 'cliente';
  due_date?: string;
  projectId: string;
  projectTitle: string;
  taskIdx: number;
}

interface Props { tasks: TaskWithMeta[]; }

export function TasksKanban({ tasks }: Props) {
  const router = useRouter();
  const cols = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    (async () => {
      const Sortable = (await import('sortablejs')).default;
      const insts: Array<ReturnType<typeof Sortable.create>> = [];
      cols.current.forEach(el => {
        const inst = Sortable.create(el, {
          group: 'tasks',
          animation: 200,
          ghostClass: 'opacity-40',
          dragClass: 'rotate-2',
          onEnd: async evt => {
            const card = evt.item;
            const newStatus = (evt.to as HTMLElement).dataset.status as TaskStatusKey;
            const projectId = card.dataset.projectId;
            const taskIdx = parseInt(card.dataset.taskIdx || '0');
            if (!projectId || !newStatus) return;
            try {
              const r = await fetch('/api/admin/task-move', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, taskIdx, newStatus }),
              });
              const d = await r.json();
              if (d.ok) showToast('Tarea movida', 'ok');
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

  function statusOf(t: TaskWithMeta): TaskStatusKey {
    if (t.done) return 'done';
    if (t.status === 'in_progress') return 'in_progress';
    return 'todo';
  }

  const byStatus = new Map<TaskStatusKey, TaskWithMeta[]>();
  for (const k of TASK_STATUS) byStatus.set(k.key, []);
  for (const t of tasks) byStatus.get(statusOf(t))!.push(t);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {TASK_STATUS.map(status => {
        const items = byStatus.get(status.key) || [];
        return (
          <div key={status.key}>
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.color, boxShadow: `0 0 6px ${status.color}` }} />
                <span className="text-xs font-semibold text-foreground">{status.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground mono">{items.length}</span>
            </div>
            <div data-status={status.key} ref={el => { if (el) cols.current.set(status.key, el); }}
              className="bg-[var(--bg-inset)] rounded-lg p-2 min-h-[400px] space-y-2">
              {items.map(t => (
                <Link key={`${t.projectId}-${t.taskIdx}`}
                  href={`/admin/projects/${t.projectId}`}
                  data-project-id={t.projectId}
                  data-task-idx={t.taskIdx}
                  className="block bg-card rounded-lg p-3 cursor-grab active:cursor-grabbing border border-[var(--border)] hover:border-[var(--border-strong)]">
                  <div className="flex items-start gap-2">
                    {t.priority && (
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                        t.priority === 'high' ? 'bg-[var(--red)]' :
                        t.priority === 'medium' ? 'bg-[var(--amber)]' : 'bg-[var(--text-3)]'
                      }`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground">{t.text}</div>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                        <span className="truncate">{t.projectTitle}</span>
                        {t.assignee && <span>· {t.assignee}</span>}
                        {t.due_date && <span>· {new Date(t.due_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {items.length === 0 && <div className="text-center text-[10px] text-muted-foreground py-8">Arrastrá tareas acá</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
