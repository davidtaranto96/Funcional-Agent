import * as db from '@/lib/db';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { FacturaForm } from '../FacturaForm';

export const dynamic = 'force-dynamic';

export default async function NuevaFacturaPage() {
  const [projects, clients] = await Promise.all([
    db.listProjects(),
    db.listClientRecords(),
  ]);

  return (
    <div className="max-w-[900px] mx-auto">
      <Link href="/admin/facturas" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-3 transition-colors">
        <ChevronLeft className="w-3 h-3" /> Volver a facturas
      </Link>

      <div className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">Nueva factura</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Cargá un comprobante para llevar control interno · sin emisión AFIP
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
        clients={clients.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
        }))}
      />
    </div>
  );
}
