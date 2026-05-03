import * as db from '@/lib/db';
import Link from 'next/link';
import { TrendingUp, Server, Cpu, Calculator } from 'lucide-react';
import { formatARS } from '@/lib/utils';
import { KPICard } from '@/components/admin/KPICard';

export const dynamic = 'force-dynamic';

const SERVICES = [
  { name: 'Railway',          monthly: 5,    currency: 'USD', usage: 62, status: 'ok'   as const, notes: 'Hosting + DB' },
  { name: 'Turso',            monthly: 0,    currency: 'USD', usage: 12, status: 'ok'   as const, notes: 'Tier gratis' },
  { name: 'Anthropic Claude', monthly: 8.40, currency: 'USD', usage: 84, status: 'warn' as const, notes: 'pago por uso' },
  { name: 'Groq Whisper',     monthly: 0.50, currency: 'USD', usage: 18, status: 'ok'   as const, notes: 'pago por uso' },
  { name: 'Twilio WA',        monthly: 0,    currency: 'USD', usage: 8,  status: 'ok'   as const, notes: 'pago por mensaje' },
  { name: 'Resend',           monthly: 0,    currency: 'USD', usage: 5,  status: 'ok'   as const, notes: 'Tier gratis' },
  { name: 'Google Workspace', monthly: 0,    currency: 'USD', usage: 0,  status: 'ok'   as const, notes: '—' },
  { name: 'Dominio .com',     monthly: 1,    currency: 'USD', usage: 0,  status: 'ok'   as const, notes: '~12/año' },
];

const API_PRICING = [
  { service: 'Claude Haiku 4.5',  input: 1.00,  output: 5.00,  unit: 'USD/1M tokens', uses: 'Conversaciones, reportes, mockup WA' },
  { service: 'Claude Sonnet 4',   input: 3.00,  output: 15.00, unit: 'USD/1M tokens', uses: 'Demo landing pages' },
  { service: 'Groq Whisper v3',   input: 0.111, output: 0,     unit: 'USD/hora audio', uses: 'Transcripción de audios' },
];

// Mini SVG bar chart de últimos N meses (mock — sin tracking real todavía)
const INCOME_HISTORY = [
  { m: 'Nov', v: 320000 },
  { m: 'Dic', v: 480000 },
  { m: 'Ene', v: 920000 },
  { m: 'Feb', v: 1200000 },
  { m: 'Mar', v: 1850000 },
  { m: 'Abr', v: 350000 },
  { m: 'May', v: 480000 },
];

export default async function FinanzasPage() {
  const projects = await db.listProjects();

  const totalBudgetARS = projects.reduce((acc, p) => {
    const num = parseFloat(String(p.budget || '0').replace(/[^\d.-]/g, ''));
    return acc + (Number.isFinite(num) ? num : 0);
  }, 0);

  const cobrado = projects
    .filter(p => p.budget_status === 'paid' || p.status === 'delivered')
    .reduce((acc, p) => {
      const num = parseFloat(String(p.budget || '0').replace(/[^\d.-]/g, ''));
      return acc + (Number.isFinite(num) ? num : 0);
    }, 0);

  const pendiente = totalBudgetARS - cobrado;
  const totalInfraUSD = SERVICES.reduce((acc, s) => acc + (s.monthly || 0), 0);

  const presupuestosAbiertos = projects.filter(p => p.budget_status === 'sent' || p.budget_status === 'draft').length;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Finanzas</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Pipeline de ingresos · costos de infraestructura · APIs por uso
          </p>
        </div>
        <Link
          href="/admin/presupuesto"
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
          style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
        >
          <Calculator className="w-3.5 h-3.5" /> Nuevo presupuesto
        </Link>
      </div>

      {/* KPIs (con valores en ARS reales — fmt formatter dentro) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <FinKpiCard
          label="Pipeline total"
          valueLabel={formatARS(totalBudgetARS)}
          sub={`${projects.length} proyectos`}
          color="oklch(0.62 0.20 250)"
          pct={Math.min(100, projects.length * 8)}
        />
        <FinKpiCard
          label="Cobrado YTD"
          valueLabel={formatARS(cobrado)}
          sub="entregado / pagado"
          color="oklch(0.62 0.16 160)"
          pct={totalBudgetARS > 0 ? Math.round((cobrado / totalBudgetARS) * 100) : 0}
        />
        <FinKpiCard
          label="Pendiente cobro"
          valueLabel={formatARS(pendiente)}
          sub="por facturar / cobrar"
          color="oklch(0.74 0.16 75)"
          pct={totalBudgetARS > 0 ? Math.round((pendiente / totalBudgetARS) * 100) : 0}
        />
        <KPICard
          label="Presupuestos abiertos"
          value={presupuestosAbiertos}
          sub={presupuestosAbiertos > 0 ? 'sin aprobar' : 'al día'}
          color={presupuestosAbiertos > 0 ? 'oklch(0.62 0.18 290)' : 'oklch(0.62 0.16 160)'}
          pct={Math.min(100, presupuestosAbiertos * 25)}
          delay={240}
        />
      </div>

      {/* Income chart + Infra panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        {/* Income chart */}
        <div className="lg:col-span-2 bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--accent-strong)]" />
              <h2 className="text-[14px] font-semibold text-foreground">Ingresos últimos 7 meses</h2>
            </div>
            <span className="mono text-[11px] text-muted-foreground">
              {formatARS(INCOME_HISTORY.reduce((s, d) => s + d.v, 0))} total
            </span>
          </div>
          <IncomeChart data={INCOME_HISTORY} />
          <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
            * Datos de ejemplo — el módulo de tracking real se integra cuando se complete Facturas (Fase 3).
          </p>
        </div>

        {/* Infra costs sidebar */}
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)]">
          <div className="px-4 pt-3.5 pb-2.5 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
              <span className="text-[13px] font-semibold text-foreground">Infraestructura</span>
            </div>
            <span className="mono text-[11px] font-bold text-foreground">{totalInfraUSD.toFixed(2)} USD/mes</span>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {SERVICES.map(s => (
              <li key={s.name} className="px-4 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: s.status === 'ok' ? 'var(--green)' : 'var(--amber)' }}
                    />
                    <span className="text-[12px] text-foreground truncate">{s.name}</span>
                  </div>
                  <span className="mono text-[11px] text-muted-foreground whitespace-nowrap">
                    ${s.monthly.toFixed(2)}
                  </span>
                </div>
                <div className="h-0.5 rounded-sm bg-[var(--bg-inset)] overflow-hidden">
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${s.usage}%`,
                      background: s.status === 'ok' ? 'var(--green)' : 'var(--amber)',
                      transition: 'width 1.2s cubic-bezier(.25,.46,.45,.94)',
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* API pricing */}
      <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[var(--accent-strong)]" />
          <h2 className="text-[14px] font-semibold text-foreground">Precios de APIs (pago por uso)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-5 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Servicio</th>
                <th className="text-right px-5 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Input</th>
                <th className="text-right px-5 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Output</th>
                <th className="text-left px-5 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hidden md:table-cell">Usos en el sistema</th>
              </tr>
            </thead>
            <tbody>
              {API_PRICING.map(p => (
                <tr key={p.service} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-inset)] transition-colors">
                  <td className="px-5 py-2.5 text-foreground">{p.service}</td>
                  <td className="px-5 py-2.5 text-right mono text-foreground">${p.input}</td>
                  <td className="px-5 py-2.5 text-right mono text-foreground">${p.output}</td>
                  <td className="px-5 py-2.5 text-muted-foreground hidden md:table-cell text-[11px]">{p.uses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-[10px] text-muted-foreground border-t border-[var(--border)]">
          Precios al 2026 · {API_PRICING[0].unit}. El tracking de uso real se integra con el módulo de
          {' '}<Link href="/admin/presupuesto" className="text-[var(--accent-strong)] hover:underline">Presupuestos</Link>.
        </p>
      </div>
    </div>
  );
}

// KPI con label de string (no number) — variante para montos formateados
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
      <div className="relative mono text-[22px] font-bold leading-none text-foreground" style={{ letterSpacing: '-1.2px' }}>
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

function IncomeChart({ data }: { data: { m: string; v: number }[] }) {
  const max = Math.max(...data.map(d => d.v), 1);
  return (
    <div className="flex items-end gap-2 h-[140px] px-1">
      {data.map((d, i) => {
        const h = Math.max(2, Math.round((d.v / max) * 130));
        const isLast = i === data.length - 1;
        return (
          <div key={d.m} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <div className="w-full flex items-end justify-center" style={{ height: 130 }} title={`${d.m}: ${formatARS(d.v)}`}>
              <div
                className="w-full rounded-t-md transition-all hover:opacity-80"
                style={{
                  height: h,
                  background: isLast ? 'var(--accent)' : 'color-mix(in oklch, var(--accent) 30%, var(--bg-inset))',
                  boxShadow: isLast ? `0 -4px 12px var(--accent-glow)` : 'none',
                }}
              />
            </div>
            <span className="mono text-[10px] text-muted-foreground">{d.m}</span>
          </div>
        );
      })}
    </div>
  );
}
