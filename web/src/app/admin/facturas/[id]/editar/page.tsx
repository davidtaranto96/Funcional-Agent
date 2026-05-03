import * as db from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { FacturaForm } from '../../FacturaForm';

export const dynamic = 'force-dynamic';

export default async function EditarFacturaPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [inv, projects, clients] = await Promise.all([
    db.getInvoice(id),
    db.listProjects(),
    db.listClientRecords(),
  ]);
  if (!inv) notFound();

  return (
    <div className="max-w-[900px] mx-auto">
      <Link href={`/admin/facturas/${inv.id}`} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-3 transition-colors">
        <ChevronLeft className="w-3 h-3" /> Volver al detalle
      </Link>

      <div className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">
          Editar factura <span className="mono text-[var(--accent-strong)]">{inv.number}</span>
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Cambios visibles inmediatamente en el listado.
        </p>
      </div>

      <FacturaForm
        projects={projects.map(p => ({
          id: p.id,
          title: p.title || 'Sin título',
          client_name: p.client_name,
          client_id: p.client_id,
          budget: p.budget,
        }))}
        clients={clients.map(c => ({ id: c.id, name: c.name, email: c.email }))}
        initial={{
          id: inv.id,
          number: inv.number,
          client_id: inv.client_id,
          client_name: inv.client_name,
          project_id: inv.project_id,
          issue_date: inv.issue_date,
          due_date: inv.due_date,
          currency: inv.currency,
          status: inv.status,
          notes: inv.notes,
          items: inv.items,
        }}
      />
    </div>
  );
}
