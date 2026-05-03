import * as db from '@/lib/db';
import Link from 'next/link';
import { TasksKanban, type TaskWithMeta } from './TasksKanban';
import type { Task } from '@/lib/constants';
import { LayoutGrid, List } from 'lucide-react';

export const dynamic = 'force-dynamic';

const CAT_PRIORITY: Record<string, number> = { cliente: 0, ventas: 1, desarrollo: 2, diseño: 3, personal: 4, otro: 5 };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ filter?: string; view?: string }> }) {
  const sp = await searchParams;
  const filter = sp.filter || 'all';
  const view = sp.view === 'list' ? 'list' : 'kanban';

  const projects = await db.listProjects();

  const allTasks: TaskWithMeta[] = projects
    .sort((a, b) => (CAT_PRIORITY[a.category] ?? 99) - (CAT_PRIORITY[b.category] ?? 99))
    .flatMap(p => ((p.tasks || []) as Task[]).map((t, idx) => ({
      ...t,
      projectId: p.id,
      projectTitle: p.title || 'Sin título',
      taskIdx: idx,
    })));

  let filtered = allTasks;
  if (filter === 'high') filtered = filtered.filter(t => t.priority === 'high' && !t.done);
  else if (filter === 'overdue') filtered = filtered.filter(t => t.due_date && !t.done && new Date(t.due_date) < new Date());
  else if (filter === 'today') filtered = filtered.filter(t => {
    if (t.done || !t.due_date) return false;
    const days = Math.ceil((new Date(t.due_date).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 1;
  });
  else if (filter === 'david') filtered = filtered.filter(t => t.assignee === 'david');
  else if (filter === 'hermana') filtered = filtered.filter(t => t.assignee === 'hermana');

  const counts = {
    all: allTasks.filter(t => !t.done).length,
    high: allTasks.filter(t => t.priority === 'high' && !t.done).length,
    overdue: allTasks.filter(t => t.due_date && !t.done && new Date(t.due_date) < new Date()).length,
    today: allTasks.filter(t => {
      if (t.done || !t.due_date) return false;
      const days = Math.ceil((new Date(t.due_date).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 1;
    }).length,
  };

  const filterTabs = [
    { key: 'all', label: `Todas (${counts.all})` },
    { key: 'high', label: `Alta (${counts.high})` },
    counts.overdue > 0 ? { key: 'overdue', label: `Vencidas (${counts.overdue})` } : null,
    counts.today > 0 ? { key: 'today', label: `Hoy (${counts.today})` } : null,
    { key: 'david', label: 'David' },
    { key: 'hermana', label: 'Hermana' },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">Tareas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{counts.all} pendientes</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[var(--bg-inset)] rounded-md p-0.5 gap-0.5">
            <Link href={`/admin/tasks?filter=${filter}&view=list`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs ${view === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              <List className="w-3.5 h-3.5" /> Lista
            </Link>
            <Link href={`/admin/tasks?filter=${filter}&view=kanban`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs ${view === 'kanban' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5 overflow-x-auto pb-2">
        {filterTabs.map(t => (
          <Link key={t.key} href={`/admin/tasks?filter=${t.key}&view=${view}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              filter === t.key
                ? 'bg-[var(--accent)] text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}>
            {t.label}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-[var(--border-strong)] rounded-xl p-12 text-center">
          <p className="text-sm text-muted-foreground">No hay tareas con este filtro.</p>
        </div>
      ) : view === 'kanban' ? (
        <TasksKanban tasks={filtered} />
      ) : (
        <div className="bg-card border border-[var(--border)] rounded-xl shadow-[var(--shadow-soft)] overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {filtered.map(t => (
              <li key={`${t.projectId}-${t.taskIdx}`}>
                <Link href={`/admin/projects/${t.projectId}`} className="flex items-center gap-3 p-3 hover:bg-[var(--bg-inset)] transition-colors">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    t.priority === 'high' ? 'bg-[var(--red)]' :
                    t.priority === 'medium' ? 'bg-[var(--amber)]' : 'bg-[var(--text-3)]'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${t.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{t.text}</div>
                    <div className="text-[10px] text-muted-foreground">{t.projectTitle}</div>
                  </div>
                  {t.assignee && <span className="text-[10px] text-muted-foreground">{t.assignee}</span>}
                  {t.due_date && <span className="text-[10px] text-[var(--amber)]">📅 {new Date(t.due_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
