import * as db from '@/lib/db';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Mail, Phone, Building2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['cliente', 'lead', 'proveedor', 'colaborador', 'otro'] as const;

export default async function ClientesPage() {
  const clientes = await db.listClientRecords();

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">Clientes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{clientes.length} registros · CRM general (separado del pipeline de WhatsApp)</p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/clientes/nuevo"><Plus className="w-4 h-4" /> Nuevo</Link>
        </Button>
      </div>

      {clientes.length === 0 ? (
        <div className="bg-card border border-dashed border-[var(--border-strong)] rounded-xl p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">Sin clientes en el CRM todavía.</p>
          <Button asChild size="sm">
            <Link href="/admin/clientes/nuevo">Agregar el primero</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {clientes.map(c => (
            <Link
              key={c.id}
              href={`/admin/clientes/${c.id}`}
              className="bg-card border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-soft)] hover:border-[var(--border-strong)] transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-full grid place-items-center text-xs font-semibold flex-shrink-0" style={{ background: 'var(--bg-card-2)', color: 'var(--text-1)' }}>
                    {(c.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{c.name || 'Sin nombre'}</div>
                    {c.company && <div className="text-[10px] text-muted-foreground truncate">{c.company}</div>}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] flex-shrink-0">{c.category}</Badge>
              </div>
              <div className="space-y-1 text-[10px] text-muted-foreground">
                {c.phone && <div className="flex items-center gap-1.5 truncate"><Phone className="w-3 h-3" /> {c.phone}</div>}
                {c.email && <div className="flex items-center gap-1.5 truncate"><Mail className="w-3 h-3" /> {c.email}</div>}
                {c.company && <div className="flex items-center gap-1.5 truncate"><Building2 className="w-3 h-3" /> {c.company}</div>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
