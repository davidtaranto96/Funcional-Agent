import { notFound } from 'next/navigation';
import Link from 'next/link';
import * as db from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';

const CATEGORIES = ['cliente', 'lead', 'proveedor', 'colaborador', 'otro'];

export const dynamic = 'force-dynamic';

export default async function EditClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.getClientRecord(id);
  if (!c) notFound();

  const projects = await db.getProjectsByClientId(id);

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/admin/clientes" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        ← Volver a clientes
      </Link>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">{c.name || 'Sin nombre'}</h1>
          {c.company && <p className="text-xs text-muted-foreground mt-0.5">{c.company}</p>}
        </div>
        <form method="POST" action={`/api/admin/clientes/${id}/delete`}
          onSubmit={(e) => { if (!confirm('¿Borrar este cliente?')) e.preventDefault(); }}>
          <Button type="submit" variant="ghost" size="sm" className="text-[var(--red)]">
            <Trash2 className="w-3.5 h-3.5" /> Borrar
          </Button>
        </form>
      </div>

      <form method="POST" action={`/api/admin/clientes/${id}/update`} className="bg-card border border-[var(--border)] rounded-xl p-5 space-y-4 shadow-[var(--shadow-soft)] mb-5">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" defaultValue={c.name} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={c.phone} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={c.email} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="company">Empresa</Label>
            <Input id="company" name="company" defaultValue={c.company} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Categoría</Label>
            <select id="category" name="category" defaultValue={c.category}
              className="flex h-10 w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {CATEGORIES.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notas</Label>
          <textarea id="notes" name="notes" rows={4} defaultValue={c.notes}
            className="flex w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <div className="flex justify-end pt-2">
          <Button type="submit" size="sm">Guardar cambios</Button>
        </div>
      </form>

      {/* Projects vinculados */}
      <div className="bg-card border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[length:var(--h2-size)] font-semibold">Proyectos vinculados</h2>
          <span className="text-[10px] text-muted-foreground mono">{projects.length}</span>
        </div>
        {projects.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin proyectos vinculados a este cliente.</p>
        ) : (
          <ul className="space-y-2">
            {projects.map(p => (
              <li key={p.id}>
                <Link href={`/admin/projects/${p.id}`} className="flex items-center justify-between bg-[var(--bg-inset)] rounded-md px-3 py-2 hover:bg-[var(--bg-card-2)] transition-colors">
                  <span className="text-xs text-foreground truncate">{p.title}</span>
                  <span className="text-[10px] text-muted-foreground">{p.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
