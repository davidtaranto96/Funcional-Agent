import { Receipt } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function FacturasPage() {
  return (
    <div className="max-w-[800px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">Facturas</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Emisión y control de cobro · gestión interna (sin AFIP)</p>
      </div>

      <div className="bg-card rounded-[var(--r-lg)] border border-dashed border-[var(--border-strong)] p-10 text-center">
        <div className="inline-grid place-items-center w-12 h-12 rounded-xl bg-[var(--bg-inset)] mb-4">
          <Receipt className="w-6 h-6 text-muted-foreground" />
        </div>
        <h2 className="text-[15px] font-semibold text-foreground mb-1">Próximamente</h2>
        <p className="text-[13px] text-muted-foreground max-w-md mx-auto mb-4">
          El módulo de facturas se implementará en la próxima fase. Por ahora podés gestionar la facturación desde
          {' '}
          <Link href="/admin/presupuesto" className="text-[var(--accent-strong)] hover:underline">Presupuestos</Link>.
        </p>
        <p className="mono text-[10px] text-[var(--text-3)] uppercase tracking-wider">Fase 3 · v4.1.0</p>
      </div>
    </div>
  );
}
