import * as db from '@/lib/db';
import { PresupuestoCalc } from './PresupuestoCalc';

export const dynamic = 'force-dynamic';

export default async function PresupuestoPage() {
  const projects = await db.listProjects();

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">Calculadora de Presupuestos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Cotizá proyectos en ARS y USD con detalle completo · Vinculá a un proyecto y guardá el budget</p>
        </div>
      </div>
      <PresupuestoCalc projects={projects} />
    </div>
  );
}
