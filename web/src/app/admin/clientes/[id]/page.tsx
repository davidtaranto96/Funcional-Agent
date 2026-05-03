import { notFound } from 'next/navigation';
import Link from 'next/link';
import * as db from '@/lib/db';
import { ArrowLeft, Trash2, FolderKanban, Plus } from 'lucide-react';
import { Field, inputCls, textareaCls, selectCls, PrimaryButton, GhostDangerButton } from '@/components/admin/FormPrimitives';
import { ConfirmForm } from '@/components/admin/ConfirmForm';

const CATEGORIES = ['cliente', 'lead', 'proveedor', 'colaborador', 'otro'];

const CATEGORY_COLORS: Record<string, string> = {
  cliente:     'oklch(0.62 0.20 250)',
  lead:        'oklch(0.74 0.16 75)',
  proveedor:   'oklch(0.62 0.18 290)',
  colaborador: 'oklch(0.62 0.16 160)',
  otro:        'oklch(0.5 0.05 250)',
};

export const dynamic = 'force-dynamic';

export default async function EditClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.getClientRecord(id);
  if (!c) notFound();

  const projects = await db.getProjectsByClientId(id);
  const initial = (c.name || '?').charAt(0).toUpperCase();
  const catColor = CATEGORY_COLORS[c.category] || 'oklch(0.5 0.05 250)';

  return (
    <div className="max-w-[800px] mx-auto">
      <Link
        href="/admin/clientes"
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="w-3 h-3" /> Volver a clientes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className="w-12 h-12 rounded-full grid place-items-center text-[16px] font-bold text-white flex-shrink-0"
            style={{
              background: catColor,
              boxShadow: `0 4px 14px color-mix(in oklch, ${catColor} 30%, transparent)`,
            }}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold tracking-tight text-foreground leading-tight">
              {c.name || 'Sin nombre'}
            </h1>
            {c.company && <div className="text-[13px] text-muted-foreground mt-0.5">{c.company}</div>}
            <span
              className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider rounded px-2 py-1 mt-2 capitalize"
              style={{
                background: `color-mix(in oklch, ${catColor} 14%, transparent)`,
                color: catColor,
              }}
            >
              {c.category}
            </span>
          </div>
        </div>
        <ConfirmForm
          method="POST"
          action={`/api/admin/clientes/${id}/delete`}
          confirm={{
            title: '¿Borrar este cliente?',
            description: 'Esta acción no se puede deshacer. Los proyectos vinculados quedarán huérfanos.',
            confirmLabel: 'Sí, borrar',
            variant: 'danger',
          }}
        >
          <GhostDangerButton type="submit">
            <Trash2 className="w-3 h-3" /> Borrar
          </GhostDangerButton>
        </ConfirmForm>
      </div>

      {/* Edit form */}
      <form
        method="POST"
        action={`/api/admin/clientes/${id}/update`}
        className="bg-card border border-[var(--border)] rounded-[var(--r-lg)] p-5 space-y-4 shadow-[var(--shadow-soft)] mb-5"
      >
        <Field label="Nombre" required>
          <input name="name" defaultValue={c.name} required className={inputCls} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Teléfono">
            <input name="phone" type="tel" defaultValue={c.phone} className={inputCls} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={c.email} className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Empresa">
            <input name="company" defaultValue={c.company} className={inputCls} />
          </Field>
          <Field label="Categoría">
            <select name="category" defaultValue={c.category} className={selectCls}>
              {CATEGORIES.map(k => <option key={k} value={k} className="capitalize">{k}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Notas">
          <textarea name="notes" rows={4} defaultValue={c.notes} className={textareaCls} />
        </Field>

        <div className="flex justify-end pt-2">
          <PrimaryButton type="submit">Guardar cambios</PrimaryButton>
        </div>
      </form>

      {/* Projects vinculados */}
      <div className="bg-card border border-[var(--border)] rounded-[var(--r-lg)] shadow-[var(--shadow-soft)] overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
            <h2 className="text-[13px] font-semibold text-foreground">Proyectos vinculados</h2>
            <span className="mono text-[10px] text-muted-foreground">{projects.length}</span>
          </div>
          <Link
            href={`/admin/projects/nuevo?client_id=${id}`}
            className="inline-flex items-center gap-1 text-[11px] text-[var(--accent-strong)] hover:underline"
          >
            <Plus className="w-3 h-3" /> Nuevo proyecto
          </Link>
        </div>
        {projects.length === 0 ? (
          <p className="text-[12px] text-muted-foreground p-4">Sin proyectos vinculados a este cliente.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {projects.map(p => (
              <li key={p.id}>
                <Link
                  href={`/admin/projects/${p.id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-inset)] transition-colors"
                >
                  <span className="text-[12px] text-foreground truncate">{p.title || 'Sin título'}</span>
                  <span className="mono text-[10px] text-muted-foreground capitalize whitespace-nowrap ml-2">{p.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
