import Link from 'next/link';
import { ArrowLeft, ContactRound } from 'lucide-react';
import { Field, inputCls, textareaCls, selectCls, PrimaryButton, SecondaryButton } from '@/components/admin/FormPrimitives';

const CATEGORIES = ['cliente', 'lead', 'proveedor', 'colaborador', 'otro'];

export default function NewClientePage() {
  return (
    <div className="max-w-[640px] mx-auto">
      <Link
        href="/admin/clientes"
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="w-3 h-3" /> Volver a clientes
      </Link>

      <div className="flex items-start gap-3.5 mb-5">
        <div
          className="grid place-items-center w-10 h-10 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] flex-shrink-0"
          style={{ boxShadow: '0 4px 14px var(--accent-glow)' }}
        >
          <ContactRound className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Nuevo cliente</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Agregar un contacto al CRM general</p>
        </div>
      </div>

      <form
        method="POST"
        action="/api/admin/clientes/create"
        className="bg-card border border-[var(--border)] rounded-[var(--r-lg)] p-5 space-y-4 shadow-[var(--shadow-soft)]"
      >
        <Field label="Nombre" required>
          <input name="name" required autoFocus className={inputCls} placeholder="Juan García" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Teléfono">
            <input name="phone" type="tel" className={inputCls} placeholder="0387 422-1234" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" className={inputCls} placeholder="juan@empresa.com" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Empresa">
            <input name="company" className={inputCls} placeholder="Clínica San Martín" />
          </Field>
          <Field label="Categoría">
            <select name="category" defaultValue="cliente" className={selectCls}>
              {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Notas" hint="Contexto, historial breve, lo que sea útil recordar">
          <textarea name="notes" rows={4} className={textareaCls} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href="/admin/clientes"
            className="inline-flex items-center justify-center h-9 px-3.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </Link>
          <SecondaryButton type="reset">Limpiar</SecondaryButton>
          <PrimaryButton type="submit">Crear cliente</PrimaryButton>
        </div>
      </form>
    </div>
  );
}
