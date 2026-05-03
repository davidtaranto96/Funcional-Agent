import Link from 'next/link';
import { ChevronLeft, Server, Cpu } from 'lucide-react';

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

export default function FinanzasCostosPage() {
  const totalInfraUSD = SERVICES.reduce((acc, s) => acc + (s.monthly || 0), 0);

  return (
    <div className="max-w-[1200px] mx-auto">
      <Link href="/admin/finanzas" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-3 transition-colors">
        <ChevronLeft className="w-3 h-3" /> Volver a Finanzas
      </Link>

      <div className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">Costos de infraestructura</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Servicios externos y APIs que usa el sistema · pricing actualizado a 2026
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
        {/* Infra */}
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)]">
          <div className="px-4 pt-3.5 pb-2.5 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
              <span className="text-[13px] font-semibold text-foreground">Infraestructura</span>
            </div>
            <span className="mono text-[12px] font-bold text-foreground">${totalInfraUSD.toFixed(2)} USD/mes</span>
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
                    <span className="text-[10px] text-muted-foreground">· {s.notes}</span>
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

        {/* API pricing */}
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)] overflow-hidden">
          <div className="px-4 pt-3.5 pb-2.5 border-b border-[var(--border)] flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
            <span className="text-[13px] font-semibold text-foreground">APIs (pago por uso)</span>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-2 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Servicio</th>
                <th className="text-right px-4 py-2 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Input</th>
                <th className="text-right px-4 py-2 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Output</th>
              </tr>
            </thead>
            <tbody>
              {API_PRICING.map(p => (
                <tr key={p.service} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-inset)] transition-colors">
                  <td className="px-4 py-2 text-foreground">
                    <div>{p.service}</div>
                    <div className="text-[10px] text-muted-foreground">{p.uses}</div>
                  </td>
                  <td className="px-4 py-2 text-right mono text-foreground">${p.input}</td>
                  <td className="px-4 py-2 text-right mono text-foreground">${p.output}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-[10px] text-muted-foreground border-t border-[var(--border)]">
            Precios al 2026 · {API_PRICING[0].unit}.
          </p>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground italic">
        El tracking real de uso por API se integrará cuando midamos request count desde el agente.
      </p>
    </div>
  );
}
