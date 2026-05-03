import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PROJECT_STATUS } from '@/lib/constants';
import * as db from '@/lib/db';

const CATEGORIES = ['cliente', 'personal', 'ventas', 'desarrollo', 'diseño', 'otro'];

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const clientes = await db.listClientRecords();

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/admin/projects" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        ← Volver a proyectos
      </Link>
      <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight mb-6">Nuevo proyecto</h1>

      <form method="POST" action="/api/admin/projects/create" className="bg-card border border-[var(--border)] rounded-xl p-5 space-y-4 shadow-[var(--shadow-soft)]">
        <div className="space-y-1.5">
          <Label htmlFor="title">Título</Label>
          <Input id="title" name="title" required autoFocus />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="type">Tipo</Label>
            <Input id="type" name="type" placeholder="ej: Landing, App móvil" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Estado</Label>
            <select id="status" name="status" defaultValue="planning"
              className="flex h-10 w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {PROJECT_STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="category">Categoría</Label>
            <select id="category" name="category" defaultValue="cliente"
              className="flex h-10 w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deadline">Deadline</Label>
            <Input id="deadline" name="deadline" type="date" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="client_id">Cliente vinculado</Label>
          <select id="client_id" name="client_id"
            className="flex h-10 w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">— Ninguno —</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="client_name">Cliente (texto libre)</Label>
            <Input id="client_name" name="client_name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget">Presupuesto</Label>
            <Input id="budget" name="budget" placeholder="ej: 200000" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Descripción</Label>
          <textarea id="description" name="description" rows={3}
            className="flex w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notas internas</Label>
          <textarea id="notes" name="notes" rows={3}
            className="flex w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_personal" />
          <span>Proyecto personal (no de cliente)</span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button asChild variant="outline" size="sm"><Link href="/admin/projects">Cancelar</Link></Button>
          <Button type="submit" size="sm">Crear</Button>
        </div>
      </form>
    </div>
  );
}
