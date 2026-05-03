import * as db from '@/lib/db';
import Link from 'next/link';
import { TasksKanban, type TaskWithMeta } from './TasksKanban';
import { TasksUrgencyView } from './TasksUrgencyView';
import type { Task } from '@/lib/constants';
import { LayoutGrid, List, ListChecks } from 'lucide-react';

export const dynamic = 'force-dynamic';

const CAT_PRIORITY: Record<string, number> = { cliente: 0, ventas: 1, desarrollo: 2, diseño: 3, personal: 4, otro: 5 };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ filter?: string; view?: string }> }) {
  const sp = await searchParams;
  const filter = sp.filter || 'all';
  const view = sp.view === 'kanban' ? 'kanban' : 'list';

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
  else if (filter === 'done') filtered = filtered.filter(t => t.done);
  else filtered = filtered.filter(t => !t.done); // 'all' = pendientes

  const counts = {
    all:     allTasks.filter(t => !t.done).length,
    high:    allTasks.filter(t => t.priority === 'high' && !t.done).length,
    overdue: allTasks.filter(t => t.due_date && !t.done && new Date(t.due_date) < new Date()).length,
    today:   allTasks.filter(t => {
      if (t.done || !t.due_date) return false;
      const days = Math.ceil((new Date(t.due_date).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 1;
    }).length,
    done:    allTasks.filter(t => t.done).length,
  };

  const filterTabs: { key: string; label: string; count: number; tone?: string }[] = [
    { key: 'all',     label: 'Pendientes', count: counts.all },
    { key: 'overdue', label: 'Vencidas',   count: counts.overdue, tone: 'red' },
    { key: 'today',   label: 'Hoy',        count: counts.today,   tone: 'amber' },
    { key: 'high',    label: 'Alta',       count: counts.high,    tone: 'amber' },
    { key: 'david',   label: 'David',      count: 0 },
    { key: 'hermana', label: 'Hermana',    count: 0 },
    { key: 'done',    label: 'Completas',  count: counts.done,    tone: 'green' },
  ];

  return (
    <div className="max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Tareas</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            <span className="mono">{counts.all}</span> pendientes
            {counts.overdue > 0 && <> · <span className="mono text-[var(--red)]">{counts.overdue}</span> vencidas</>}
            {counts.today > 0 && <> · <span className="mono text-[var(--amber)]">{counts.today}</span> para hoy</>}
          </p>
        </div>
        <div className="flex items-center bg-[var(--bg-card-2)] border border-[var(--border)] rounded-md p-0.5">
          <Link
            href={`/admin/tasks?filter=${filter}&view=list`}
            className={`flex items-center gap-1.5 h-7 px-2.5 rounded text-[11px] font-medium transition-colors ${
              view === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="w-3 h-3" /> Por urgencia
          </Link>
          <Link
            href={`/admin/tasks?filter=${filter}&view=kanban`}
            className={`flex items-center gap-1.5 h-7 px-2.5 rounded text-[11px] font-medium transition-colors ${
              view === 'kanban' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="w-3 h-3" /> Kanban
          </Link>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {filterTabs.map(t => {
          const active = filter === t.key;
          const tone =
            t.tone === 'red' ? 'oklch(0.62 0.22 27)' :
            t.tone === 'amber' ? 'oklch(0.74 0.16 75)' :
            t.tone === 'green' ? 'oklch(0.62 0.16 160)' :
            'oklch(0.62 0.20 250)';
          return (
            <Link
              key={t.key}
              href={`/admin/tasks?filter=${t.key}&view=${view}`}
              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
                active
                  ? 'text-foreground border'
                  : 'text-muted-foreground hover:text-foreground bg-[var(--bg-card-2)] border border-transparent'
              }`}
              style={active ? {
                background: `color-mix(in oklch, ${tone} 14%, transparent)`,
                color: tone,
                borderColor: `color-mix(in oklch, ${tone} 30%, transparent)`,
              } : undefined}
            >
              {t.label}
              {t.count > 0 && (
                <span className="mono text-[10px] opacity-70">{t.count}</span>
              )}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-[var(--border-strong)] rounded-[var(--r-lg)] p-12 text-center">
          <div className="inline-grid place-items-center w-12 h-12 rounded-xl bg-[var(--bg-inset)] mb-4">
            <ListChecks className="w-6 h-6 text-[var(--green)]" />
          </div>
          <h2 className="text-[15px] font-semibold text-foreground mb-1">¡Todo al día!</h2>
          <p className="text-[12px] text-muted-foreground">No hay tareas con este filtro.</p>
        </div>
      ) : view === 'kanban' ? (
        <TasksKanban tasks={filtered} />
      ) : (
        <TasksUrgencyView tasks={filtered} />
      )}
    </div>
  );
}
