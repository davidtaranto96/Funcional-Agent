import * as db from '@/lib/db';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Wallet, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatARS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const SERVICES = [
  { name: 'Railway', monthly: 5, currency: 'USD' },
  { name: 'Turso', monthly: 0, currency: 'USD' },
  { name: 'Resend', monthly: 0, currency: 'USD' },
  { name: 'Twilio (WhatsApp)', monthly: 0, currency: 'USD', notes: 'pago por uso' },
  { name: 'Anthropic Claude', monthly: 0, currency: 'USD', notes: 'pago por uso' },
  { name: 'Groq Whisper', monthly: 0, currency: 'USD', notes: 'pago por uso' },
  { name: 'Google Workspace', monthly: 0, currency: 'USD' },
  { name: 'Dominio (.com)', monthly: 1, currency: 'USD', notes: '~12/año' },
];

const API_PRICING = [
  { service: 'Claude Haiku 4.5',  input: 1.00, output: 5.00,  unit: 'USD/1M tokens', uses: 'Conversaciones, reportes, mockup WA' },
  { service: 'Claude Sonnet 4',    input: 3.00, output: 15.00, unit: 'USD/1M tokens', uses: 'Demo landing pages' },
  { service: 'Groq Whisper v3',    input: 0.111, output: 0,    unit: 'USD/hora audio', uses: 'Transcripción de audios' },
];

export default async function FinanzasPage() {
  const projects = await db.listProjects();

  // Pipeline financiero — proyectos con presupuesto
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

  // Costos infra mensual
  const totalInfraUSD = SERVICES.reduce((acc, s) => acc + (s.monthly || 0), 0);

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">Finanzas</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Pipeline de ingresos, costos de infraestructura y APIs</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[var(--accent-strong)]" />
            <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Pipeline total</span>
          </div>
          <div className="mono text-3xl font-semibold text-foreground">{formatARS(totalBudgetARS)}</div>
          <div className="text-xs text-muted-foreground mt-1">{projects.length} proyectos</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--green)]" />
            <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Cobrado</span>
          </div>
          <div className="mono text-3xl font-semibold text-[var(--green)]">{formatARS(cobrado)}</div>
          <div className="text-xs text-muted-foreground mt-1">Entregados / pagados</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-[var(--amber)]" />
            <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Pendiente</span>
          </div>
          <div className="mono text-3xl font-semibold text-[var(--amber)]">{formatARS(pendiente)}</div>
          <div className="text-xs text-muted-foreground mt-1">Por cobrar</div>
        </Card>
      </div>

      {/* Costos infra */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[var(--accent-strong)]" />
            <h2 className="text-[length:var(--h2-size)] font-semibold">Infraestructura mensual</h2>
          </div>
          <span className="mono text-sm text-foreground">{totalInfraUSD} USD/mes</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SERVICES.map(s => (
            <div key={s.name} className="flex items-center justify-between p-3 bg-[var(--bg-inset)] rounded-md">
              <div>
                <div className="text-sm text-foreground">{s.name}</div>
                {s.notes && <div className="text-[10px] text-muted-foreground">{s.notes}</div>}
              </div>
              <span className="mono text-xs text-muted-foreground">{s.monthly} {s.currency}/mes</span>
            </div>
          ))}
        </div>
      </Card>

      {/* API pricing */}
      <Card className="p-5">
        <h2 className="text-[length:var(--h2-size)] font-semibold mb-4">Precios de APIs (por uso)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-[var(--border)]">
              <tr>
                <th className="text-left py-2 font-medium">Servicio</th>
                <th className="text-right py-2 font-medium">Input</th>
                <th className="text-right py-2 font-medium">Output</th>
                <th className="text-left py-2 font-medium hidden md:table-cell">Usos</th>
              </tr>
            </thead>
            <tbody>
              {API_PRICING.map(p => (
                <tr key={p.service} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2.5 text-foreground">{p.service}</td>
                  <td className="py-2.5 text-right mono">${p.input}</td>
                  <td className="py-2.5 text-right mono">${p.output}</td>
                  <td className="py-2.5 text-muted-foreground hidden md:table-cell">{p.uses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          Precios vigentes al 2026. Todos en {API_PRICING[0].unit}. Para tracking de uso real, ver
          <Link href="/admin/presupuesto" className="text-[var(--accent-strong)] hover:underline ml-1">Presupuesto</Link>.
        </p>
      </Card>
    </div>
  );
}
