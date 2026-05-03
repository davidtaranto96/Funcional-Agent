import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CATEGORIES = ['cliente', 'lead', 'proveedor', 'colaborador', 'otro'];

export default function NewClientePage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/admin/clientes" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        ← Volver a clientes
      </Link>
      <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight mb-6">Nuevo cliente</h1>

      <form method="POST" action="/api/admin/clientes/create" className="bg-card border border-[var(--border)] rounded-xl p-5 space-y-4 shadow-[var(--shadow-soft)]">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" required autoFocus />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" name="phone" type="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="company">Empresa</Label>
            <Input id="company" name="company" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Categoría</Label>
            <select id="category" name="category" defaultValue="cliente"
              className="flex h-10 w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notas</Label>
          <textarea id="notes" name="notes" rows={4}
            className="flex w-full rounded-md border border-[var(--border-strong)] bg-input px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button asChild variant="outline" size="sm"><Link href="/admin/clientes">Cancelar</Link></Button>
          <Button type="submit" size="sm">Crear</Button>
        </div>
      </form>
    </div>
  );
}
