import * as db from '@/lib/db';
import { PipelineKanban } from './PipelineKanban';
import { PipelineToolbar } from './PipelineToolbar';
import { Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface SP {
  view?: string;
  sort?: string;
  archived?: string;
  q?: string;
  stage?: string;
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = sp.view === 'list' ? 'list' : 'kanban';
  const sort = (sp.sort && ['recent', 'oldest', 'name', 'stage'].includes(sp.sort) ? sp.sort : 'recent') as 'recent' | 'oldest' | 'name' | 'stage';
  const showArchived = sp.archived === '1';
  const search = (sp.q || '').trim();
  const stageFilter = sp.stage || '';

  const clients = await db.listAllClients(showArchived);

  // Stats — siempre sobre el set NO archivado
  const visible = showArchived ? clients.filter(c => !c.archived) : clients;
  const ganados = visible.filter(c => c.client_stage === 'won').length;
  const perdidos = visible.filter(c => c.client_stage === 'lost').length;
  const activos = visible.length - ganados - perdidos;
  const demosEnviadas = visible.filter(c => c.demo_status === 'sent' || c.demo_status === 'approved').length;

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Header + Toolbar */}
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-start gap-3.5">
          <div
            className="grid place-items-center w-10 h-10 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] flex-shrink-0"
            style={{ boxShadow: '0 4px 14px var(--accent-glow)' }}
          >
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-foreground">Pipeline</h1>
            <p className="text-[13px] text-muted-foreground mt-1">Consultas recibidas por WhatsApp</p>
          </div>
        </div>

        <PipelineToolbar
          view={view}
          sort={sort}
          showArchived={showArchived}
          search={search}
          stage={stageFilter}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total contactos" value={visible.length} color="oklch(0.62 0.20 250)" />
        <StatCard label="En proceso" value={activos} color="oklch(0.62 0.18 250)" />
        <StatCard label="Demos enviadas" value={demosEnviadas} color="oklch(0.62 0.18 290)" />
        <StatCard label="Proyectos ganados" value={ganados} color="oklch(0.62 0.16 160)" />
      </div>

      {showArchived && (
        <div className="bg-[oklch(0.74_0.16_75_/_0.10)] border border-[oklch(0.74_0.16_75_/_0.30)] rounded-xl px-4 py-2.5 mb-4 text-[12px] flex items-center justify-between">
          <span className="text-foreground">Mostrando contactos archivados</span>
          <a href="/admin/clients" className="text-[var(--amber)] font-semibold hover:underline">Volver a activos →</a>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="bg-card border border-dashed border-[var(--border-strong)] rounded-[var(--r-lg)] p-12 text-center">
          <div className="inline-grid place-items-center w-12 h-12 rounded-xl bg-[var(--bg-inset)] mb-4">
            <Users className="w-6 h-6 text-muted-foreground" />
          </div>
          <h2 className="text-[15px] font-semibold text-foreground mb-1">
            {showArchived ? 'Sin archivados' : 'Sin contactos todavía'}
          </h2>
          <p className="text-[12px] text-muted-foreground max-w-md mx-auto">
            {showArchived
              ? 'Los contactos que archives aparecerán acá.'
              : 'Cuando llegue el primer mensaje a tu WhatsApp, aparece acá. Mientras tanto, podés crear un lead de prueba.'}
          </p>
        </div>
      ) : (
        <PipelineKanban
          clients={clients}
          view={view}
          sort={sort}
          search={search}
          stageFilter={stageFilter}
          showArchived={showArchived}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="relative bg-card rounded-[var(--r-lg)] border border-[var(--border)] px-4 py-3.5 shadow-[var(--shadow-soft)] overflow-hidden">
      <div
        className="pointer-events-none absolute top-0 right-0 w-[60px] h-[60px] rounded-full"
        style={{ background: `radial-gradient(circle at 100% 0%, color-mix(in oklch, ${color} 18%, transparent), transparent 70%)` }}
        aria-hidden
      />
      <div className="relative text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">{label}</div>
      <div className="relative mono text-[24px] font-bold leading-none" style={{ color, letterSpacing: '-0.8px' }}>
        {value}
      </div>
    </div>
  );
}
