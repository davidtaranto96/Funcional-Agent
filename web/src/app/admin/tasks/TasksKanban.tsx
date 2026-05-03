'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Calendar } from 'lucide-react';
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

const PRIORITY_COLOR: Record<string, string> = {
  high:   'oklch(0.62 0.22 27)',
  medium: 'oklch(0.74 0.16 75)',
  low:    'oklch(0.5 0.05 250)',
};

interface Props { tasks: TaskWithMeta[] }

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
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            <div className="flex items-center justify-between px-1 mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: status.color, boxShadow: `0 0 8px ${status.color}` }}
                />
                <span className="text-[12px] font-semibold text-foreground">{status.label}</span>
              </div>
              <span
                className="mono text-[10px] font-semibold text-muted-foreground rounded-full px-1.5 py-0.5"
                style={{ background: 'color-mix(in oklch, var(--bg-inset) 80%, transparent)' }}
              >
                {items.length}
              </span>
            </div>
            <div
              data-status={status.key}
              ref={el => { if (el) cols.current.set(status.key, el); }}
              className="bg-[var(--bg-inset)] rounded-[var(--r-md)] p-2 min-h-[400px] space-y-2 border border-dashed border-transparent hover:border-[var(--border-strong)] transition-colors"
            >
              {items.map(t => (
                <Link
                  key={`${t.projectId}-${t.taskIdx}`}
                  href={`/admin/projects/${t.projectId}`}
                  data-project-id={t.projectId}
                  data-task-idx={t.taskIdx}
                  className="block bg-card rounded-[var(--r-md)] p-3 cursor-grab active:cursor-grabbing border border-[var(--border)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] hover:border-[var(--border-strong)]"
                >
                  <div className="flex items-start gap-2">
                    {t.priority && (
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                        style={{ background: PRIORITY_COLOR[t.priority] }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12px] leading-snug ${t.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {t.text}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
                        <span className="truncate">{t.projectTitle}</span>
                        {t.assignee && (
                          <span className="inline-flex items-center gap-0.5 capitalize">
                            <User className="w-2.5 h-2.5" /> {t.assignee}
                          </span>
                        )}
                        {t.due_date && (
                          <span className="mono inline-flex items-center gap-0.5">
                            <Calendar className="w-2.5 h-2.5" />
                            {t.due_date.split('-').reverse().slice(0, 2).join('/')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {items.length === 0 && (
                <div className="text-center text-[10px] text-muted-foreground py-8 px-2">Arrastrá tareas acá</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
