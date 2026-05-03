'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/ui/toast';
import { confirmDialog } from '@/components/admin/ConfirmModal';
import { Trash2, Check, User } from 'lucide-react';
import type { Task } from '@/lib/constants';

const PRIORITY_COLOR: Record<string, string> = {
  high:   'oklch(0.62 0.22 27)',
  medium: 'oklch(0.74 0.16 75)',
  low:    'oklch(0.5 0.05 250)',
};

export function TasksList({ projectId, initialTasks }: { projectId: string; initialTasks: Task[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);

  async function toggle(idx: number) {
    const newTasks = [...tasks];
    newTasks[idx] = { ...newTasks[idx], done: !newTasks[idx].done, status: !newTasks[idx].done ? 'done' : 'todo' };
    setTasks(newTasks);
    try {
      const r = await fetch(`/api/admin/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', idx }),
      });
      if (!r.ok) throw new Error('failed');
    } catch {
      showToast('Error', 'err');
      router.refresh();
    }
  }

  async function del(idx: number) {
    const ok = await confirmDialog({
      title: '¿Borrar esta tarea?',
      description: tasks[idx]?.text ? `"${tasks[idx].text}"` : undefined,
      confirmLabel: 'Sí, borrar',
      variant: 'danger',
    });
    if (!ok) return;
    const newTasks = tasks.filter((_, i) => i !== idx);
    setTasks(newTasks);
    try {
      const r = await fetch(`/api/admin/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', idx }),
      });
      if (!r.ok) throw new Error('failed');
    } catch {
      showToast('Error', 'err');
      router.refresh();
    }
  }

  if (tasks.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground py-4 text-center">
        Sin tareas todavía. Agregá la primera abajo.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {tasks.map((t, idx) => {
        const today = new Date().toISOString().slice(0, 10);
        const overdue = !t.done && t.due_date && t.due_date < today;
        return (
          <li
            key={idx}
            className="flex items-center gap-2.5 group rounded-md px-2 py-1.5 hover:bg-[var(--bg-inset)] transition-colors"
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex-shrink-0 grid place-items-center transition-colors ${
                t.done
                  ? 'bg-[var(--green)] border-[var(--green)]'
                  : 'border-[var(--border-strong)] hover:border-[var(--accent)]'
              }`}
              aria-label={t.done ? 'Desmarcar' : 'Marcar completa'}
            >
              {t.done && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
            </button>
            <span
              className={`text-[13px] flex-1 min-w-0 truncate ${
                t.done ? 'text-muted-foreground line-through' : 'text-foreground'
              }`}
            >
              {t.text}
            </span>
            {t.priority && (
              <span
                className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                style={{ background: PRIORITY_COLOR[t.priority] || 'var(--text-3)' }}
                title={`Prioridad ${t.priority}`}
              />
            )}
            {t.assignee && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground capitalize">
                <User className="w-2.5 h-2.5" /> {t.assignee}
              </span>
            )}
            {t.due_date && (
              <span
                className={`mono text-[10px] whitespace-nowrap ${
                  overdue ? 'text-[var(--red)] font-semibold' : 'text-muted-foreground'
                }`}
              >
                {t.due_date.split('-').reverse().slice(0, 2).join('/')}
              </span>
            )}
            <button
              type="button"
              onClick={() => del(idx)}
              className="text-[var(--red)] opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[oklch(0.62_0.22_27_/_0.10)]"
              aria-label="Borrar tarea"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
