import Link from 'next/link';
import { ArrowLeft, FolderKanban } from 'lucide-react';
import { PROJECT_STATUS } from '@/lib/constants';
import * as db from '@/lib/db';
import { Field, inputCls, textareaCls, selectCls, PrimaryButton } from '@/components/admin/FormPrimitives';

const CATEGORIES = ['cliente', 'personal', 'ventas', 'desarrollo', 'diseño', 'otro'];

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const clientes = await db.listClientRecords();

  return (
    <div className="max-w-[720px] mx-auto">
      <Link
        href="/admin/projects"
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="w-3 h-3" /> Volver a proyectos
      </Link>

      <div className="flex items-start gap-3.5 mb-5">
        <div
          className="grid place-items-center w-10 h-10 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] flex-shrink-0"
          style={{ boxShadow: '0 4px 14px var(--accent-glow)' }}
        >
          <FolderKanban className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Nuevo proyecto</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Definí los datos básicos · podés agregar tareas después</p>
        </div>
      </div>

      <form
        method="POST"
        action="/api/admin/projects/create"
        className="bg-card border border-[var(--border)] rounded-[var(--r-lg)] p-5 space-y-4 shadow-[var(--shadow-soft)]"
      >
        <Field label="Título" required>
          <input name="title" required autoFocus className={inputCls} placeholder="Ej. App de gestión clínica" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tipo">
            <input name="type" className={inputCls} placeholder="Web, app, landing…" />
          </Field>
          <Field label="Estado">
            <select name="status" defaultValue="planning" className={selectCls}>
              {PROJECT_STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Categoría">
            <select name="category" defaultValue="cliente" className={selectCls}>
              {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </Field>
          <Field label="Deadline">
            <input name="deadline" type="date" className={inputCls} />
          </Field>
        </div>

        <Field label="Cliente vinculado" hint="Si no aparece, agregá el cliente desde Clientes y volvé acá">
          <select name="client_id" defaultValue="" className={selectCls}>
            <option value="">— Ninguno —</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Cliente (texto libre)" hint="Si no querés vincular un cliente del CRM">
            <input name="client_name" className={inputCls} />
          </Field>
          <Field label="Presupuesto (ARS)">
            <input name="budget" className={inputCls} placeholder="$ 0" />
          </Field>
        </div>

        <Field label="Descripción">
          <textarea name="description" rows={3} className={textareaCls} />
        </Field>

        <Field label="Notas internas">
          <textarea name="notes" rows={3} className={textareaCls} />
        </Field>

        <label className="flex items-center gap-2 text-[12px] text-foreground cursor-pointer pt-1">
          <input
            type="checkbox"
            name="is_personal"
            className="w-4 h-4 rounded border border-[var(--border-strong)] bg-[var(--bg-input)] text-[var(--accent)] cursor-pointer"
          />
          <span>Proyecto personal (no de cliente)</span>
        </label>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)] mt-2">
          <Link
            href="/admin/projects"
            className="inline-flex items-center justify-center h-9 px-3.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </Link>
          <PrimaryButton type="submit">Crear proyecto</PrimaryButton>
        </div>
      </form>
    </div>
  );
}
