import * as db from '@/lib/db';
import { Calculator } from 'lucide-react';
import { PresupuestoCalc } from './PresupuestoCalc';

export const dynamic = 'force-dynamic';

export default async function PresupuestoPage() {
  const projects = await db.listProjects();

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div
            className="grid place-items-center w-10 h-10 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] flex-shrink-0"
            style={{ boxShadow: '0 4px 14px var(--accent-glow)' }}
          >
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-foreground">Calculadora de Presupuestos</h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              Cotizá proyectos en ARS y USD con detalle completo · Vinculá a un proyecto y guardá el presupuesto
            </p>
          </div>
        </div>
      </div>

      <PresupuestoCalc projects={projects} />
    </div>
  );
}
