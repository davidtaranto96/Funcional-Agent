import * as db from '@/lib/db';
import { PipelineKanban } from './PipelineKanban';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const clients = await db.listAllClients();

  const ganados = clients.filter(c => c.client_stage === 'won').length;
  const perdidos = clients.filter(c => c.client_stage === 'lost').length;
  const activos = clients.length - ganados - perdidos;

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">Pipeline WhatsApp</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {clients.length} total · <span className="text-[var(--green)]">{ganados} ganados</span> · {activos} activos · <span className="text-muted-foreground">{perdidos} perdidos</span>
          </p>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="bg-card border border-dashed border-[var(--border-strong)] rounded-xl p-12 text-center">
          <p className="text-sm text-muted-foreground">Sin contactos todavía. Cuando llegue el primer mensaje a tu WhatsApp, aparece acá.</p>
        </div>
      ) : (
        <PipelineKanban clients={clients} />
      )}
    </div>
  );
}
