'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, User, AlertCircle, Clock, CalendarDays, Calendar } from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import type { TaskWithMeta } from './TasksKanban';

const PRIORITY_COLOR: Record<string, string> = {
  high:   'oklch(0.62 0.22 27)',
  medium: 'oklch(0.74 0.16 75)',
  low:    'oklch(0.5 0.05 250)',
};

interface Group {
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
  tasks: TaskWithMeta[];
}

export function TasksUrgencyView({ tasks: initial }: { tasks: TaskWithMeta[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);

  const groups = useMemo<Group[]>(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString().slice(0, 10);
    const in7days = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);

    const overdue: TaskWithMeta[] = [];
    const todayList: TaskWithMeta[] = [];
    const week: TaskWithMeta[] = [];
    const later: TaskWithMeta[] = [];
    const noDate: TaskWithMeta[] = [];

    for (const t of tasks) {
      if (!t.due_date) { noDate.push(t); continue; }
      if (t.due_date < todayISO) overdue.push(t);
      else if (t.due_date === todayISO) todayList.push(t);
      else if (t.due_date <= in7days) week.push(t);
      else later.push(t);
    }

    return [
      { key: 'overdue', label: 'Atrasadas',   Icon: AlertCircle, color: 'oklch(0.62 0.22 27)', tasks: overdue },
      { key: 'today',   label: 'Hoy',         Icon: Clock,       color: 'oklch(0.74 0.16 75)', tasks: todayList },
      { key: 'week',    label: 'Esta semana', Icon: CalendarDays, color: 'oklch(0.62 0.20 250)', tasks: week },
      { key: 'later',   label: 'Más adelante', Icon: Calendar,   color: 'oklch(0.5 0.05 250)', tasks: later },
      { key: 'nodate',  label: 'Sin fecha',   Icon: Calendar,    color: 'oklch(0.5 0.05 250)', tasks: noDate },
    ].filter(g => g.tasks.length > 0);
  }, [tasks]);

  async function toggle(t: TaskWithMeta) {
    const newDone = !t.done;
    setTasks(curr =>
      curr.map(x =>
        x.projectId === t.projectId && x.taskIdx === t.taskIdx ? { ...x, done: newDone } : x,
      ),
    );
    try {
      const r = await fetch(`/api/admin/projects/${t.projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', idx: t.taskIdx }),
      });
      if (!r.ok) throw new Error('failed');
      if (newDone) showToast('Tarea completada', 'ok');
    } catch {
      showToast('Error', 'err');
      router.refresh();
    }
  }

  return (
    <div className="space-y-5">
      {groups.map(g => (
        <section key={g.key}>
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <div
              className="grid place-items-center w-5 h-5 rounded"
              style={{ background: `color-mix(in oklch, ${g.color} 14%, transparent)`, color: g.color }}
            >
              <g.Icon className="w-3 h-3" />
            </div>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: g.color }}>
              {g.label}
            </h2>
            <span className="mono text-[10px] text-muted-foreground">{g.tasks.length}</span>
          </div>

          <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)] overflow-hidden">
            <ul className="divide-y divide-[var(--border)]">
              {g.tasks.map(t => (
                <li
                  key={`${t.projectId}-${t.taskIdx}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-inset)] transition-colors group"
                >
                  <button
                    type="button"
                    onClick={() => toggle(t)}
                    className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex-shrink-0 grid place-items-center transition-colors ${
                      t.done
                        ? 'bg-[var(--green)] border-[var(--green)]'
                        : 'border-[var(--border-strong)] hover:border-[var(--accent)]'
                    }`}
                    aria-label={t.done ? 'Desmarcar' : 'Marcar completa'}
                  >
                    {t.done && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </button>

                  <Link href={`/admin/projects/${t.projectId}`} className="flex-1 min-w-0">
                    <div
                      className={`text-[13px] truncate ${
                        t.done ? 'text-muted-foreground line-through' : 'text-foreground'
                      }`}
                    >
                      {t.text}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{t.projectTitle}</div>
                  </Link>

                  {t.priority && (
                    <span
                      className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                      style={{ background: PRIORITY_COLOR[t.priority] || 'var(--text-3)' }}
                      title={`Prioridad ${t.priority}`}
                    />
                  )}
                  {t.assignee && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground capitalize">
                      <User className="w-2.5 h-2.5" /> {t.assignee}
                    </span>
                  )}
                  {t.due_date && (
                    <span
                      className={`mono text-[10px] whitespace-nowrap ${
                        g.key === 'overdue' ? 'text-[var(--red)] font-bold' : 'text-muted-foreground'
                      }`}
                    >
                      {t.due_date.split('-').reverse().slice(0, 2).join('/')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
