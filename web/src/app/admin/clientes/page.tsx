import * as db from '@/lib/db';
import Link from 'next/link';
import { Plus, ContactRound } from 'lucide-react';
import { ClientesView } from './ClientesView';

export const dynamic = 'force-dynamic';

export default async function ClientesPage() {
  const [clientes, projects] = await Promise.all([
    db.listClientRecords(),
    db.listProjects(),
  ]);

  // Map de cuántos proyectos tiene cada cliente
  const projectsByClient = new Map<string, number>();
  for (const p of projects) {
    if (p.client_id) projectsByClient.set(p.client_id, (projectsByClient.get(p.client_id) || 0) + 1);
  }
  const clientesWithCount = clientes.map(c => ({ ...c, _projects: projectsByClient.get(c.id) || 0 }));

  return (
    <div className="max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Clientes</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {clientes.length} registros · base de contactos del CRM
          </p>
        </div>
        <Link
          href="/admin/clientes/nuevo"
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
          style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo cliente
        </Link>
      </div>

      {clientesWithCount.length === 0 ? (
        <EmptyState />
      ) : (
        <ClientesView clientes={clientesWithCount} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-card border border-dashed border-[var(--border-strong)] rounded-[var(--r-lg)] p-12 text-center">
      <div className="inline-grid place-items-center w-12 h-12 rounded-xl bg-[var(--bg-inset)] mb-4">
        <ContactRound className="w-6 h-6 text-muted-foreground" />
      </div>
      <h2 className="text-[15px] font-semibold text-foreground mb-1">Sin clientes todavía</h2>
      <p className="text-[12px] text-muted-foreground max-w-md mx-auto mb-4">
        Agregá tu primer contacto para empezar a llevar el CRM general (separado del pipeline de WhatsApp).
      </p>
      <Link
        href="/admin/clientes/nuevo"
        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
        style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
      >
        <Plus className="w-3.5 h-3.5" /> Agregar el primero
      </Link>
    </div>
  );
}
