import { Card } from '@/components/ui/card';
import { Calculator, Info } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PresupuestoPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">Presupuesto</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Calculadora rápida en pesos y dólares</p>
      </div>

      <Card className="p-6 mb-5">
        <div className="flex items-start gap-3">
          <Calculator className="w-5 h-5 text-[var(--accent-strong)] flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-[length:var(--h2-size)] font-semibold mb-2">Migración Wave 4 — placeholder</h2>
            <p className="text-sm text-muted-foreground mb-3">
              La calculadora completa de presupuestos (mano de obra + servicios + licencias + tipo de cambio configurable + vista cliente con beneficios + impresión) sigue en el legacy Express.
              Se port&aacute; en una sesi&oacute;n futura — la l&oacute;gica es ~600 l&iacute;neas que requieren refactor a React state.
            </p>
            <div className="flex gap-2">
              <Link href="/admin" className="text-xs text-[var(--accent-strong)] hover:underline">← Dashboard</Link>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-2 mb-3">
          <Info className="w-4 h-4 text-[var(--amber)] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Para presupuestar un proyecto nuevo en el panel actual, andá a un proyecto y editá el campo <strong className="text-foreground">budget</strong>.
            La <Link href="/admin/finanzas" className="text-[var(--accent-strong)] hover:underline">página de finanzas</Link> agrega todos los presupuestos y muestra cuánto está cobrado vs pendiente.
          </p>
        </div>
      </Card>
    </div>
  );
}
