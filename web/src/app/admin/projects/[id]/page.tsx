import { notFound } from 'next/navigation';
import Link from 'next/link';
import * as db from '@/lib/db';
import { Trash2, ArrowLeft, Calendar, User, Wallet, Tag } from 'lucide-react';
import { PROJECT_STATUS, type Task } from '@/lib/constants';
import { formatARS, timeAgo } from '@/lib/utils';
import { ProjectDetailTabs } from './ProjectDetailTabs';
import { ConfirmForm } from '@/components/admin/ConfirmForm';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await db.getProject(id);
  if (!p) notFound();

  const tasks = (p.tasks || []) as Task[];
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.done).length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const status = PROJECT_STATUS.find(s => s.key === p.status);
  const budgetNum = Number(String(p.budget || '').replace(/[^\d.-]/g, ''));
  const initial = (p.title || '?').charAt(0).toUpperCase();

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Back */}
      <Link
        href="/admin/projects"
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="w-3 h-3" /> Volver a proyectos
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className="w-12 h-12 rounded-xl grid place-items-center text-[16px] font-bold text-white flex-shrink-0"
            style={{
              background: status?.color || 'var(--accent)',
              boxShadow: `0 4px 14px color-mix(in oklch, ${status?.color || 'var(--accent)'} 30%, transparent)`,
            }}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold tracking-tight text-foreground leading-tight">{p.title || 'Sin título'}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {status && (
                <span
                  className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider rounded px-2 py-1"
                  style={{
                    background: `color-mix(in oklch, ${status.color} 14%, transparent)`,
                    color: status.color,
                  }}
                >
                  {status.label}
                </span>
              )}
              {p.client_name && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <User className="w-3 h-3" /> {p.client_name}
                </span>
              )}
              {p.deadline && (
                <span className="inline-flex items-center gap-1 mono text-[11px] text-[var(--amber)]">
                  <Calendar className="w-3 h-3" />
                  {new Date(p.deadline).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              )}
              {Number.isFinite(budgetNum) && budgetNum > 0 && (
                <span className="inline-flex items-center gap-1 mono text-[11px] text-muted-foreground">
                  <Wallet className="w-3 h-3" /> {formatARS(budgetNum)}
                </span>
              )}
              {p.category && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground capitalize">
                  <Tag className="w-3 h-3" /> {p.category}
                </span>
              )}
            </div>
          </div>
        </div>
        <ConfirmForm
          method="POST"
          action={`/api/admin/projects/${id}/delete`}
          confirm={{
            title: '¿Borrar este proyecto?',
            description: 'Se eliminarán también las tareas, notas y bitácora asociadas. Esta acción no se puede deshacer.',
            confirmLabel: 'Sí, borrar',
            variant: 'danger',
          }}
        >
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] text-[var(--red)] hover:bg-[oklch(0.62_0.22_27_/_0.10)] transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Borrar
          </button>
        </ConfirmForm>
      </div>

      {/* Progress bar (visible siempre que haya tareas) */}
      {totalTasks > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="mono uppercase tracking-wider text-muted-foreground font-semibold">Progreso</span>
            <span className="mono text-muted-foreground">{doneTasks} de {totalTasks} · {pct}%</span>
          </div>
          <div className="h-1.5 rounded-sm bg-[var(--bg-inset)] overflow-hidden">
            <div
              className="h-full rounded-sm bg-[var(--accent)]"
              style={{ width: `${pct}%`, transition: 'width 1s ease' }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <ProjectDetailTabs
        projectId={id}
        project={{
          title: p.title,
          type: p.type,
          status: p.status,
          category: p.category,
          deadline: p.deadline,
          client_name: p.client_name,
          client_id: p.client_id,
          client_phone: p.client_phone,
          client_email: p.client_email,
          budget: p.budget,
          budget_status: p.budget_status,
          description: p.description,
          notes: p.notes,
        }}
        tasks={tasks}
        updates={(p.updates_log || []).slice(0, 50).map(u => ({ date: u.date, text: u.text, ago: timeAgo(u.date) }))}
      />
    </div>
  );
}
