import * as db from '@/lib/db';
import Link from 'next/link';
import { Plus, LayoutGrid, List, FolderKanban } from 'lucide-react';
import { ProjectsKanban } from './ProjectsKanban';
import { ProjectsList } from './ProjectsList';
import { formatARS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sp = await searchParams;
  const view = sp.view === 'list' ? 'list' : 'kanban';
  const projects = await db.listProjects();

  const active = projects.filter(p => ['planning', 'in_progress', 'waiting_client', 'waiting_payment', 'review'].includes(p.status));
  const delivered = projects.filter(p => p.status === 'delivered');
  const totalBudget = projects
    .map(p => Number(String(p.budget || '').replace(/[^\d.-]/g, '')))
    .filter(n => Number.isFinite(n))
    .reduce((s, n) => s + n, 0);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Proyectos</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            <span className="mono">{projects.length}</span> total · <span className="mono text-[var(--accent-strong)]">{active.length}</span> activos · <span className="mono text-[var(--green)]">{delivered.length}</span> entregados
            {totalBudget > 0 && <> · <span className="mono">{formatARS(totalBudget)}</span> en cartera</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[var(--bg-card-2)] border border-[var(--border)] rounded-md p-0.5">
            <Link
              href="/admin/projects?view=kanban"
              className={`flex items-center gap-1.5 h-7 px-2.5 rounded text-[11px] font-medium transition-colors ${
                view === 'kanban' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-3 h-3" /> Kanban
            </Link>
            <Link
              href="/admin/projects?view=list"
              className={`flex items-center gap-1.5 h-7 px-2.5 rounded text-[11px] font-medium transition-colors ${
                view === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-3 h-3" /> Lista
            </Link>
          </div>
          <Link
            href="/admin/projects/nuevo"
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
            style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="bg-card border border-dashed border-[var(--border-strong)] rounded-[var(--r-lg)] p-12 text-center">
          <div className="inline-grid place-items-center w-12 h-12 rounded-xl bg-[var(--bg-inset)] mb-4">
            <FolderKanban className="w-6 h-6 text-muted-foreground" />
          </div>
          <h2 className="text-[15px] font-semibold text-foreground mb-1">Sin proyectos todavía</h2>
          <p className="text-[12px] text-muted-foreground max-w-md mx-auto mb-4">
            Convertí un lead del pipeline en proyecto, o creá uno desde cero.
          </p>
          <Link
            href="/admin/projects/nuevo"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
            style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Crear el primero
          </Link>
        </div>
      ) : view === 'kanban' ? (
        <ProjectsKanban projects={projects} />
      ) : (
        <ProjectsList projects={projects} />
      )}
    </div>
  );
}
