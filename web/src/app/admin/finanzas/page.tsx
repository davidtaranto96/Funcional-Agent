import * as db from '@/lib/db';
import Link from 'next/link';
import { TrendingUp, Calculator, Receipt, Server, ArrowRight, Plus } from 'lucide-react';
import { formatARS } from '@/lib/utils';
import { KPICard } from '@/components/admin/KPICard';

export const dynamic = 'force-dynamic';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function buildIncomeHistory(invoices: { paid_at: string; amount: number; currency: string }[]) {
  // Últimos 7 meses, basado en paid_at
  const now = new Date();
  const buckets: { key: string; label: string; v: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ key, label: MONTHS[d.getMonth()], v: 0 });
  }
  for (const inv of invoices) {
    if (!inv.paid_at) continue;
    const k = inv.paid_at.slice(0, 7);
    const bucket = buckets.find(b => b.key === k);
    if (bucket && inv.currency === 'ARS') bucket.v += inv.amount;
  }
  return buckets;
}

export default async function FinanzasPage() {
  const [projects, invoices] = await Promise.all([
    db.listProjects(),
    db.listInvoices(),
  ]);

  // KPIs basados en facturas REALES (no en projects.budget_status)
  const totalEmitido = invoices.reduce((s, i) => s + (i.amount || 0), 0);
  const cobrado = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const enrichedSent = invoices.map(inv =>
    (inv.status === 'sent' && inv.due_date && inv.due_date < today) ? { ...inv, status: 'overdue' } : inv
  );
  const pendiente = enrichedSent.filter(i => i.status === 'sent').reduce((s, i) => s + (i.amount || 0), 0);
  const vencido = enrichedSent.filter(i => i.status === 'overdue').reduce((s, i) => s + (i.amount || 0), 0);

  const presupuestosAbiertos = projects.filter(p => p.budget_status === 'sent' || p.budget_status === 'draft').length;

  // Income chart real
  const incomeHistory = buildIncomeHistory(invoices);
  const totalIncome = incomeHistory.reduce((s, b) => s + b.v, 0);

  // Próximos cobros: facturas sent con due_date en los próximos 14 días
  const in14days = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const upcoming = enrichedSent
    .filter(i => i.status === 'sent' && i.due_date && i.due_date >= today && i.due_date <= in14days)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    .slice(0, 5);

  // Últimos cobros
  const lastPaid = invoices
    .filter(i => i.status === 'paid' && i.paid_at)
    .sort((a, b) => (b.paid_at || '').localeCompare(a.paid_at || ''))
    .slice(0, 5);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Finanzas</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Pipeline de cobros · facturación · presupuestos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/finanzas/costos"
            className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-card border border-[var(--border)] text-foreground text-[12px] font-medium hover:bg-[var(--bg-inset)] transition-colors"
          >
            <Server className="w-3.5 h-3.5" /> Costos infra
          </Link>
          <Link
            href="/admin/presupuesto"
            className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-card border border-[var(--border)] text-foreground text-[12px] font-medium hover:bg-[var(--bg-inset)] transition-colors"
          >
            <Calculator className="w-3.5 h-3.5" /> Nuevo presupuesto
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
        <FinKpiCard
          label="Total emitido"
          valueLabel={formatARS(totalEmitido)}
          sub={`${invoices.length} facturas`}
          color="oklch(0.62 0.20 250)"
          pct={Math.min(100, invoices.length * 8)}
        />
        <FinKpiCard
          label="Cobrado"
          valueLabel={formatARS(cobrado)}
          sub={cobrado > 0 ? 'pagadas' : '—'}
          color="oklch(0.62 0.16 160)"
          pct={totalEmitido > 0 ? Math.round((cobrado / totalEmitido) * 100) : 0}
        />
        <FinKpiCard
          label="Pendiente cobro"
          valueLabel={formatARS(pendiente)}
          sub={pendiente > 0 ? 'enviadas sin pagar' : 'al día'}
          color={pendiente > 0 ? 'oklch(0.74 0.16 75)' : 'oklch(0.62 0.16 160)'}
          pct={totalEmitido > 0 ? Math.round((pendiente / totalEmitido) * 100) : 0}
        />
        <FinKpiCard
          label="Vencido"
          valueLabel={formatARS(vencido)}
          sub={vencido > 0 ? `${enrichedSent.filter(i => i.status === 'overdue').length} atrasadas` : 'sin atrasos'}
          color={vencido > 0 ? 'oklch(0.62 0.22 27)' : 'oklch(0.5 0.05 250)'}
          pct={totalEmitido > 0 ? Math.round((vencido / totalEmitido) * 100) : 0}
        />
      </div>

      {/* Si no hay facturas todavía, empty state grande */}
      {invoices.length === 0 ? (
        <div className="bg-card rounded-[var(--r-lg)] border border-dashed border-[var(--border-strong)] p-10 text-center mb-5">
          <div className="inline-grid place-items-center w-12 h-12 rounded-xl bg-[var(--bg-inset)] mb-4">
            <Receipt className="w-6 h-6 text-muted-foreground" />
          </div>
          <h2 className="text-[15px] font-semibold text-foreground mb-1">Todavía no tenés facturas emitidas</h2>
          <p className="text-[13px] text-muted-foreground max-w-md mx-auto mb-4">
            Cuando emitas la primera, este panel se llena con tu pipeline real de cobros, gráfico de ingresos
            y próximos vencimientos.
          </p>
          <Link
            href="/admin/facturas/nueva"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
            style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Crear primera factura
          </Link>
        </div>
      ) : (
        <>
          {/* Income chart + Próximos cobros */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
            <div className="lg:col-span-2 bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[var(--accent-strong)]" />
                  <h2 className="text-[14px] font-semibold text-foreground">Cobros últimos 7 meses</h2>
                </div>
                <span className="mono text-[11px] text-muted-foreground">
                  {formatARS(totalIncome)} total
                </span>
              </div>
              {totalIncome > 0 ? (
                <IncomeChart data={incomeHistory} />
              ) : (
                <div className="text-center py-10 text-[12px] text-muted-foreground">
                  Sin cobros registrados todavía. Cuando marqués una factura como pagada, aparece acá.
                </div>
              )}
            </div>

            {/* Próximos cobros */}
            <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)]">
              <div className="px-4 pt-3.5 pb-2.5 border-b border-[var(--border)] flex items-center justify-between">
                <span className="text-[13px] font-semibold text-foreground">Próximos cobros</span>
                <Link href="/admin/facturas" className="text-[11px] text-[var(--accent-strong)] hover:underline">Ver todos →</Link>
              </div>
              {upcoming.length === 0 ? (
                <p className="text-[12px] text-muted-foreground p-4">Sin facturas por vencer en 14 días.</p>
              ) : (
                <ul className="py-1.5">
                  {upcoming.map(inv => {
                    const days = Math.round((new Date(inv.due_date).getTime() - Date.now()) / 86400_000);
                    const urgent = days <= 3;
                    return (
                      <li key={inv.id}>
                        <Link
                          href={`/admin/facturas/${inv.id}`}
                          className="flex items-center gap-2 py-1.5 px-4 hover:bg-[var(--bg-inset)] transition-colors"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: urgent ? 'var(--amber)' : 'var(--accent)' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-medium text-foreground truncate">{inv.client_name || inv.number}</div>
                            <div className="mono text-[10px] text-muted-foreground">vence en {days}d</div>
                          </div>
                          <span className="mono text-[11px] font-bold text-foreground">{formatARS(inv.amount)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Últimos cobros */}
          {lastPaid.length > 0 && (
            <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)] mb-5">
              <div className="px-4 pt-3.5 pb-2.5 border-b border-[var(--border)] flex items-center justify-between">
                <span className="text-[13px] font-semibold text-foreground">Últimos cobros</span>
                <Link href="/admin/facturas?filter=paid" className="text-[11px] text-[var(--accent-strong)] hover:underline">Ver todas →</Link>
              </div>
              <table className="w-full">
                <tbody>
                  {lastPaid.map(inv => (
                    <tr key={inv.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-inset)] transition-colors">
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/facturas/${inv.id}`} className="mono text-[12px] font-semibold text-foreground hover:text-[var(--accent-strong)]">
                          {inv.number || '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-muted-foreground truncate max-w-[200px]">{inv.client_name || '—'}</td>
                      <td className="px-4 py-2.5 mono text-[11px] text-muted-foreground">{inv.paid_at}</td>
                      <td className="px-4 py-2.5 text-[11px] text-muted-foreground">{inv.payment_method || '—'}</td>
                      <td className="px-4 py-2.5 text-right mono text-[12px] font-bold text-[var(--green)]">
                        {formatARS(inv.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Stats secundarias */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
        <Link
          href="/admin/presupuesto"
          className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] p-4 hover:border-[var(--border-strong)] transition-colors group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Presupuestos abiertos</span>
            <Calculator className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[var(--accent-strong)]" />
          </div>
          <div className="mono text-[18px] font-bold text-foreground">{presupuestosAbiertos}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{presupuestosAbiertos > 0 ? 'sin aprobar todavía' : 'al día'}</div>
        </Link>
        <Link
          href="/admin/finanzas/costos"
          className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] p-4 hover:border-[var(--border-strong)] transition-colors group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Costos infra</span>
            <Server className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[var(--accent-strong)]" />
          </div>
          <div className="mono text-[18px] font-bold text-foreground">~$14 USD</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">/ mes · ver desglose →</div>
        </Link>
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Margen estimado</span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="mono text-[18px] font-bold text-foreground">
            {cobrado > 0 ? formatARS(cobrado - 14 * 1000) : '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">cobrado − costos (~$14 USD/mes a $1000)</div>
        </div>
      </div>
    </div>
  );
}

function FinKpiCard({ label, valueLabel, sub, color, pct }: {
  label: string; valueLabel: string; sub: string; color: string; pct: number;
}) {
  return (
    <div className="relative block bg-card rounded-[var(--r-lg)] border border-[var(--border)] overflow-hidden shadow-[var(--shadow-soft)] px-[18px] pt-[18px] pb-[15px]">
      <div
        className="pointer-events-none absolute top-0 right-0 w-[70px] h-[70px] rounded-full"
        style={{ background: `radial-gradient(circle at 100% 0%, color-mix(in oklch, ${color} 18%, transparent), transparent 70%)` }}
        aria-hidden
      />
      <div className="relative flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        <div
          className="w-[22px] h-[22px] rounded-md grid place-items-center"
          style={{ background: `color-mix(in oklch, ${color} 13%, transparent)` }}
        >
          <span className="block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        </div>
      </div>
      <div className="relative mono text-[22px] font-bold leading-none text-foreground" style={{ letterSpacing: '-0.8px' }}>
        {valueLabel}
      </div>
      <div className="relative mt-[7px] text-[11px] text-muted-foreground">{sub}</div>
      <div className="relative mt-3 h-0.5 rounded-sm bg-[var(--bg-inset)] overflow-hidden">
        <div
          className="h-full rounded-sm"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color, transition: 'width 1.2s cubic-bezier(.25,.46,.45,.94)' }}
        />
      </div>
    </div>
  );
}

function IncomeChart({ data }: { data: { label: string; v: number }[] }) {
  const max = Math.max(...data.map(d => d.v), 1);
  return (
    <div className="flex items-end gap-2 h-[140px] px-1">
      {data.map((d, i) => {
        const h = Math.max(2, Math.round((d.v / max) * 130));
        const isLast = i === data.length - 1;
        return (
          <div key={d.label + i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <div className="w-full flex items-end justify-center" style={{ height: 130 }} title={`${d.label}: ${formatARS(d.v)}`}>
              <div
                className="w-full rounded-t-md transition-all hover:opacity-80"
                style={{
                  height: h,
                  background: isLast ? 'var(--accent)' : 'color-mix(in oklch, var(--accent) 30%, var(--bg-inset))',
                  boxShadow: isLast ? `0 -4px 12px var(--accent-glow)` : 'none',
                }}
              />
            </div>
            <span className="mono text-[10px] text-muted-foreground">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
