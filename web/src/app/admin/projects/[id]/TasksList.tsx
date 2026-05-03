'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Trash2, Check } from 'lucide-react';
import type { Task } from '@/lib/constants';

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
    if (!confirm('¿Borrar esta tarea?')) return;
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

  if (tasks.length === 0) return <p className="text-xs text-muted-foreground py-2">Sin tareas todavía.</p>;

  return (
    <ul className="space-y-1.5">
      {tasks.map((t, idx) => (
        <li key={idx} className="flex items-center gap-2 group">
          <button
            type="button"
            onClick={() => toggle(idx)}
            className={`w-4 h-4 rounded border flex-shrink-0 grid place-items-center ${
              t.done ? 'bg-[var(--green)] border-[var(--green)]' : 'border-[var(--border-strong)] hover:border-[var(--accent)]'
            }`}
            aria-label={t.done ? 'Desmarcar' : 'Marcar completa'}
          >
            {t.done && <Check className="w-3 h-3 text-white" />}
          </button>
          <span className={`text-sm flex-1 min-w-0 truncate ${t.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {t.text}
          </span>
          {t.priority && (
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              t.priority === 'high' ? 'bg-[var(--red)]' :
              t.priority === 'medium' ? 'bg-[var(--amber)]' : 'bg-[var(--text-3)]'
            }`} />
          )}
          {t.assignee && <span className="text-[10px] text-muted-foreground">{t.assignee}</span>}
          {t.due_date && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(t.due_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
            </span>
          )}
          <button type="button" onClick={() => del(idx)} className="text-[var(--red)] opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Borrar tarea">
            <Trash2 className="w-3 h-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}
