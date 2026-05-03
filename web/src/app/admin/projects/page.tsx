import * as db from '@/lib/db';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { ProjectsKanban } from './ProjectsKanban';
import { ProjectStatusBadge } from '@/components/admin/ProjectStatusBadge';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sp = await searchParams;
  const view = sp.view === 'list' ? 'list' : 'kanban';
  const projects = await db.listProjects();

  const active = projects.filter(p => ['planning', 'in_progress', 'waiting_client', 'waiting_payment', 'review'].includes(p.status));
  const delivered = projects.filter(p => p.status === 'delivered');

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">Proyectos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{projects.length} total · {active.length} activos · {delivered.length} entregados</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[var(--bg-inset)] rounded-md p-0.5 gap-0.5">
            <Link href="/admin/projects?view=list"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs ${view === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              <List className="w-3.5 h-3.5" /> Lista
            </Link>
            <Link href="/admin/projects?view=kanban"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs ${view === 'kanban' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </Link>
          </div>
          <Button asChild size="sm"><Link href="/admin/projects/nuevo"><Plus className="w-4 h-4" /> Nuevo</Link></Button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="bg-card border border-dashed border-[var(--border-strong)] rounded-xl p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">Sin proyectos todavía.</p>
          <Button asChild size="sm"><Link href="/admin/projects/nuevo">Crear el primero</Link></Button>
        </div>
      ) : view === 'kanban' ? (
        <ProjectsKanban projects={projects} />
      ) : (
        <div className="bg-card border border-[var(--border)] rounded-xl shadow-[var(--shadow-soft)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-[var(--border)]">
                <th className="text-left p-3 font-medium">Proyecto</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Cliente</th>
                <th className="text-left p-3 font-medium">Estado</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Tareas</th>
                <th className="text-right p-3 font-medium">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => {
                const tasks = (p.tasks || []) as { done?: boolean }[];
                const total = tasks.length;
                const done = tasks.filter(t => t.done).length;
                return (
                  <tr key={p.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-inset)]">
                    <td className="p-3">
                      <Link href={`/admin/projects/${p.id}`} className="text-sm font-medium text-foreground hover:underline">
                        {p.title || 'Sin título'}
                      </Link>
                      {p.type && <div className="text-[10px] text-muted-foreground">{p.type}</div>}
                    </td>
                    <td className="p-3 hidden sm:table-cell text-xs text-muted-foreground">{p.client_name || '—'}</td>
                    <td className="p-3"><ProjectStatusBadge status={p.status} /></td>
                    <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">
                      {total > 0 ? <span className="mono">{done}/{total}</span> : '—'}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground text-right">{timeAgo(p.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
