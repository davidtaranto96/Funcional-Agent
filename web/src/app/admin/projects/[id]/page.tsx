import { notFound } from 'next/navigation';
import Link from 'next/link';
import * as db from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProjectStatusBadge } from '@/components/admin/ProjectStatusBadge';
import { TasksList } from './TasksList';
import { PROJECT_STATUS, type Task } from '@/lib/constants';
import { Trash2 } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['cliente', 'personal', 'ventas', 'desarrollo', 'diseño', 'otro'];

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await db.getProject(id);
  if (!p) notFound();

  const tasks = (p.tasks || []) as Task[];
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.done).length;
  const pct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;

  return (
    <div className="max-w-[1200px] mx-auto">
      <Link href="/admin/projects" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        ← Volver a proyectos
      </Link>

      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">{p.title || 'Sin título'}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <ProjectStatusBadge status={p.status} />
            {p.client_name && <span className="text-xs text-muted-foreground">· {p.client_name}</span>}
            {p.deadline && <span className="text-xs text-[var(--amber)]">📅 {new Date(p.deadline).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
          </div>
        </div>
        <form method="POST" action={`/api/admin/projects/${id}/delete`}
          onSubmit={e => { if (!confirm('¿Borrar este proyecto?')) e.preventDefault(); }}>
          <Button type="submit" variant="ghost" size="sm" className="text-[var(--red)]">
            <Trash2 className="w-3.5 h-3.5" /> Borrar
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: edit form + tasks */}
        <div className="lg:col-span-2 space-y-5">
          {/* Edit form */}
          <form method="POST" action={`/api/admin/projects/${id}/update`} className="bg-card border border-[var(--border)] rounded-xl p-5 space-y-4 shadow-[var(--shadow-soft)]">
            <h2 className="text-[length:var(--h2-size)] font-semibold">Detalles</h2>
            <div className="space-y-1.5">
              <Label htmlFor="title">Título</Label>
              <Input id="title" name="title" defaultValue={p.title} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="type">Tipo</Label>
                <Input id="type" name="type" defaultValue={p.type} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Estado</Label>
                <select id="status" name="status" defaultValue={p.status}
                  className="flex h-10 w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm">
                  {PROJECT_STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="category">Categoría</Label>
                <select id="category" name="category" defaultValue={p.category}
                  className="flex h-10 w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deadline">Deadline</Label>
                <Input id="deadline" name="deadline" type="date" defaultValue={p.deadline?.slice(0, 10) || ''} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="client_name">Cliente</Label>
                <Input id="client_name" name="client_name" defaultValue={p.client_name} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget">Presupuesto</Label>
                <Input id="budget" name="budget" defaultValue={p.budget} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <textarea id="description" name="description" rows={3} defaultValue={p.description}
                className="flex w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notas</Label>
              <textarea id="notes" name="notes" rows={3} defaultValue={p.notes}
                className="flex w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm resize-none" />
            </div>
            <input type="hidden" name="client_id" defaultValue={p.client_id} />
            <input type="hidden" name="client_phone" defaultValue={p.client_phone} />
            <input type="hidden" name="client_email" defaultValue={p.client_email} />
            <input type="hidden" name="budget_status" defaultValue={p.budget_status} />
            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm">Guardar</Button>
            </div>
          </form>

          {/* Tasks */}
          <div className="bg-card border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[length:var(--h2-size)] font-semibold">Tareas</h2>
              {totalTasks > 0 && (
                <span className="text-[10px] text-muted-foreground mono">{doneTasks}/{totalTasks} ({pct}%)</span>
              )}
            </div>
            {totalTasks > 0 && (
              <div className="h-1 rounded-full bg-[var(--bg-inset)] overflow-hidden mb-4">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
              </div>
            )}
            <TasksList projectId={id} initialTasks={tasks} />

            <form method="POST" action={`/api/admin/projects/${id}/tasks`} className="mt-4 flex gap-2">
              <Input name="text" placeholder="Nueva tarea..." className="flex-1" />
              <select name="priority" defaultValue="medium" className="h-10 rounded-md border border-[var(--border-strong)] bg-input px-2 text-xs">
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
              <select name="assignee" defaultValue="david" className="h-10 rounded-md border border-[var(--border-strong)] bg-input px-2 text-xs">
                <option value="david">David</option>
                <option value="hermana">Hermana</option>
                <option value="cliente">Cliente</option>
              </select>
              <Button type="submit" size="sm">+</Button>
            </form>
          </div>
        </div>

        {/* Right: updates log */}
        <div className="space-y-5">
          <div className="bg-card border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-[length:var(--h2-size)] font-semibold mb-3">Bitácora</h2>
            <form method="POST" action={`/api/admin/project-update/${id}`} className="mb-4">
              <textarea name="text" rows={2} placeholder="¿Qué hiciste hoy?"
                className="w-full bg-input border border-[var(--border-strong)] rounded-md px-3 py-2 text-xs resize-none mb-2" />
              <Button type="submit" size="sm" className="w-full">Agregar update</Button>
            </form>
            <ol className="space-y-3">
              {(p.updates_log || []).slice(0, 10).map((u, i) => (
                <li key={i} className="text-xs">
                  <div className="text-muted-foreground text-[10px] mb-0.5">{timeAgo(u.date)}</div>
                  <div className="text-foreground whitespace-pre-wrap">{u.text}</div>
                </li>
              ))}
              {(p.updates_log || []).length === 0 && <p className="text-xs text-muted-foreground">Sin updates aún.</p>}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
