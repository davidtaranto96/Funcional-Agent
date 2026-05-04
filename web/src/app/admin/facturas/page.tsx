import * as db from '@/lib/db';
import Link from 'next/link';
import { Receipt, Plus, Calculator } from 'lucide-react';
import { formatARS } from '@/lib/utils';
import { FacturasView } from './FacturasView';

export const dynamic = 'force-dynamic';

export default async function FacturasPage() {
  const [invoices, projects] = await Promise.all([
    db.listInvoices(),
    db.listProjects(),
  ]);

  // Compute auto-overdue (mutates only the displayed object, no DB write)
  const today = new Date().toISOString().slice(0, 10);
  const enriched = invoices.map(inv => {
    if (inv.status === 'sent' && inv.due_date && inv.due_date < today) {
      return { ...inv, status: 'overdue' as const };
    }
    return inv;
  });

  // KPIs
  const totalEmitido = enriched.reduce((s, i) => s + (i.amount || 0), 0);
  const cobrado = enriched.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0);
  const pendiente = enriched.filter(i => i.status === 'sent').reduce((s, i) => s + (i.amount || 0), 0);
  const vencido = enriched.filter(i => i.status === 'overdue').reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Facturas</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Emisión y control de cobro · gestión interna (sin AFIP)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/presupuesto"
            className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-card border border-[var(--border)] text-foreground text-[12px] font-medium hover:bg-[var(--bg-inset)] transition-colors"
          >
            <Calculator className="w-3.5 h-3.5" /> Presupuestos
          </Link>
          <Link
            href="/admin/facturas/nueva"
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
            style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Nueva factura
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Total emitido" value={formatARS(totalEmitido)} sub={`${enriched.length} facturas`} color="oklch(0.62 0.20 250)" />
        <KpiCard label="Cobrado" value={formatARS(cobrado)} sub="pagadas" color="oklch(0.62 0.16 160)" pct={totalEmitido > 0 ? (cobrado / totalEmitido) * 100 : 0} />
        <KpiCard label="Pendiente" value={formatARS(pendiente)} sub="enviadas sin pagar" color="oklch(0.74 0.16 75)" />
        <KpiCard label="Vencido" value={formatARS(vencido)} sub="atrasadas" color={vencido > 0 ? 'oklch(0.62 0.22 27)' : 'oklch(0.5 0.05 250)'} />
      </div>

      {enriched.length === 0 ? (
        <div className="bg-card rounded-[var(--r-lg)] border border-dashed border-[var(--border-strong)] p-10 text-center">
          <div className="inline-grid place-items-center w-12 h-12 rounded-xl bg-[var(--bg-inset)] mb-4">
            <Receipt className="w-6 h-6 text-muted-foreground" />
          </div>
          <h2 className="text-[15px] font-semibold text-foreground mb-1">Todavía no emitiste ninguna factura</h2>
          <p className="text-[13px] text-muted-foreground max-w-md mx-auto mb-4">
            Creá una desde cero o partí de un{' '}
            <Link href="/admin/presupuesto" className="text-[var(--accent-strong)] hover:underline">presupuesto</Link>.
          </p>
          <Link
            href="/admin/facturas/nueva"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Crear primera factura
          </Link>
        </div>
      ) : (
        <FacturasView
          invoices={enriched}
          projects={projects.map(p => ({ id: p.id, title: p.title || 'Sin título', client_name: p.client_name }))}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, color, pct }: { label: string; value: string; sub: string; color: string; pct?: number }) {
  return (
    <div className="relative block bg-card rounded-[var(--r-lg)] border border-[var(--border)] overflow-hidden shadow-[var(--shadow-soft)] px-[18px] pt-[18px] pb-[15px]">
      <div
        className="pointer-events-none absolute top-0 right-0 w-[180px] h-[180px]"
        style={{ background: `radial-gradient(circle at 100% 0%, color-mix(in oklch, ${color} 38%, transparent), transparent 65%)` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-0 right-0 w-[90px] h-[90px]"
        style={{ background: `radial-gradient(circle at 100% 0%, color-mix(in oklch, ${color} 22%, transparent), transparent 70%)` }}
        aria-hidden
      />
      <div className="relative flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        <div
          className="w-[24px] h-[24px] rounded-md grid place-items-center"
          style={{
            background: `color-mix(in oklch, ${color} 18%, transparent)`,
            boxShadow: `0 0 12px color-mix(in oklch, ${color} 28%, transparent)`,
          }}
        >
          <span className="block w-[7px] h-[7px] rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        </div>
      </div>
      <div className="relative mono text-[22px] font-bold leading-none text-foreground" style={{ letterSpacing: '-0.8px' }}>
        {value}
      </div>
      <div className="relative mt-[7px] text-[11px] text-muted-foreground">{sub}</div>
      {pct !== undefined && (
        <div className="relative mt-3 h-0.5 rounded-sm bg-[var(--bg-inset)] overflow-hidden">
          <div
            className="h-full rounded-sm"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color, transition: 'width 1.2s cubic-bezier(.25,.46,.45,.94)' }}
          />
        </div>
      )}
    </div>
  );
}
