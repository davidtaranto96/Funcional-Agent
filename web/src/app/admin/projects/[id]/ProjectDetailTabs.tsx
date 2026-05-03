'use client';

import { useState } from 'react';
import { TasksList } from './TasksList';
import { PROJECT_STATUS, type Task } from '@/lib/constants';

const CATEGORIES = ['cliente', 'personal', 'ventas', 'desarrollo', 'diseño', 'otro'];

type Tab = 'detalles' | 'tareas' | 'bitacora';

interface ProjectData {
  title: string;
  type: string;
  status: string;
  category: string;
  deadline: string | null;
  client_name: string;
  client_id: string;
  client_phone: string;
  client_email: string;
  budget: string;
  budget_status: string;
  description: string;
  notes: string;
}

interface UpdateLog { date: string; text: string; ago: string }

export function ProjectDetailTabs({
  projectId,
  project,
  tasks,
  updates,
}: {
  projectId: string;
  project: ProjectData;
  tasks: Task[];
  updates: UpdateLog[];
}) {
  const [tab, setTab] = useState<Tab>('tareas');

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'tareas', label: 'Tareas', count: tasks.length },
    { key: 'detalles', label: 'Detalles' },
    { key: 'bitacora', label: 'Bitácora', count: updates.length },
  ];

  return (
    <div>
      {/* Tab nav */}
      <div className="flex border-b border-[var(--border)] mb-5">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative -mb-px flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium transition-colors ${
              tab === t.key
                ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent'
            }`}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span className="mono text-[10px] text-muted-foreground bg-[var(--bg-inset)] rounded px-1.5 py-px">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'tareas' && (
        <div className="bg-card border border-[var(--border)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow-soft)]">
          <TasksList projectId={projectId} initialTasks={tasks} />

          <form
            method="POST"
            action={`/api/admin/projects/${projectId}/tasks`}
            className="mt-5 grid grid-cols-[1fr_auto_auto_auto] gap-2"
          >
            <input
              name="text"
              placeholder="Nueva tarea…"
              className="h-9 px-3 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)]"
              required
            />
            <select
              name="priority"
              defaultValue="medium"
              className="h-9 px-2.5 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-[11px] text-foreground outline-none focus:border-[var(--accent)] cursor-pointer"
            >
              <option value="high">🔴 Alta</option>
              <option value="medium">🟡 Media</option>
              <option value="low">⚪ Baja</option>
            </select>
            <select
              name="assignee"
              defaultValue="david"
              className="h-9 px-2.5 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-[11px] text-foreground outline-none focus:border-[var(--accent)] cursor-pointer"
            >
              <option value="david">David</option>
              <option value="hermana">Hermana</option>
              <option value="cliente">Cliente</option>
            </select>
            <button
              type="submit"
              className="h-9 px-4 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
              style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
            >
              Agregar
            </button>
          </form>
        </div>
      )}

      {tab === 'detalles' && (
        <form
          method="POST"
          action={`/api/admin/projects/${projectId}/update`}
          className="bg-card border border-[var(--border)] rounded-[var(--r-lg)] p-5 space-y-4 shadow-[var(--shadow-soft)]"
        >
          <Field label="Título" required>
            <input name="title" defaultValue={project.title} required className={inputCls} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tipo">
              <input name="type" defaultValue={project.type} placeholder="App, web, landing…" className={inputCls} />
            </Field>
            <Field label="Estado">
              <select name="status" defaultValue={project.status} className={inputCls}>
                {PROJECT_STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Categoría">
              <select name="category" defaultValue={project.category} className={inputCls}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Deadline">
              <input name="deadline" type="date" defaultValue={project.deadline?.slice(0, 10) || ''} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Cliente">
              <input name="client_name" defaultValue={project.client_name} className={inputCls} />
            </Field>
            <Field label="Presupuesto">
              <input name="budget" defaultValue={project.budget} placeholder="$ 0" className={inputCls} />
            </Field>
          </div>

          <Field label="Descripción">
            <textarea
              name="description"
              rows={3}
              defaultValue={project.description}
              className={`${inputCls} resize-none py-2`}
            />
          </Field>

          <Field label="Notas internas">
            <textarea
              name="notes"
              rows={3}
              defaultValue={project.notes}
              className={`${inputCls} resize-none py-2`}
            />
          </Field>

          <input type="hidden" name="client_id" defaultValue={project.client_id} />
          <input type="hidden" name="client_phone" defaultValue={project.client_phone} />
          <input type="hidden" name="client_email" defaultValue={project.client_email} />
          <input type="hidden" name="budget_status" defaultValue={project.budget_status} />

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="h-9 px-4 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
              style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
            >
              Guardar cambios
            </button>
          </div>
        </form>
      )}

      {tab === 'bitacora' && (
        <div className="bg-card border border-[var(--border)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow-soft)]">
          <form method="POST" action={`/api/admin/project-update/${projectId}`} className="mb-5">
            <textarea
              name="text"
              rows={2}
              placeholder="¿Qué hiciste hoy en este proyecto?"
              className={`w-full ${inputCls} resize-none py-2`}
              required
            />
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                className="h-9 px-4 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
                style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
              >
                Agregar update
              </button>
            </div>
          </form>

          {updates.length === 0 ? (
            <p className="text-[12px] text-muted-foreground py-4 text-center">Sin updates todavía. Empezá a documentar el progreso.</p>
          ) : (
            <ol className="space-y-3 relative">
              {/* Línea vertical */}
              <span className="absolute left-1 top-1.5 bottom-1.5 w-px bg-[var(--border)]" aria-hidden />
              {updates.map((u, i) => (
                <li key={i} className="relative pl-5">
                  <span
                    className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-[var(--accent)]"
                    style={{ boxShadow: '0 0 8px var(--accent-glow)' }}
                  />
                  <div className="mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{u.ago}</div>
                  <div className="text-[12px] text-foreground whitespace-pre-wrap leading-relaxed">{u.text}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls = 'flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-3 text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)] transition-colors';

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
        {label}{required && <span className="text-[var(--red)] ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
