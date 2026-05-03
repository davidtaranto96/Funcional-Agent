import * as db from '@/lib/db';
import { STAGES, type StageKey } from '@/lib/constants';
import { KPICard } from '@/components/admin/KPICard';
import { DashboardHeader } from '@/components/admin/DashboardHeader';
import { Badge } from '@/components/ui/badge';
import { timeAgo, formatARS } from '@/lib/utils';
import Link from 'next/link';
import {
  Eye, AlertTriangle, Calendar, Receipt, FileCheck, MessageCircle, FolderKanban,
  TrendingUp, ArrowRight, CheckCircle2, ListTodo, DollarSign,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface ActivityEvent {
  type: 'demo' | 'lead' | 'invoice_paid' | 'invoice_sent' | 'task_done' | 'project_created';
  title: string;
  sub: string;
  href: string;
  ts: string;
  color: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

export default async function DashboardPage() {
  const [clients, projects, invoices] = await Promise.all([
    db.listAllClients(),
    db.listProjects(),
    db.listInvoices(),
  ]);

  const todayISO = new Date().toISOString().slice(0, 10);

  const pendingReview = clients.filter(c => c.demo_status === 'pending_review');
  const activeProjects = projects.filter(p =>
    ['planning', 'in_progress', 'waiting_client', 'waiting_payment', 'review'].includes(p.status),
  ).length;
  const pendingTasks = projects.reduce((n, p) => n + (p.tasks || []).filter(t => !(t as { done?: boolean }).done).length, 0);

  // Por cobrar (facturas sent) — auto-overdue computado
  const enrichedInvoices = invoices.map(inv =>
    (inv.status === 'sent' && inv.due_date && inv.due_date < todayISO) ? { ...inv, status: 'overdue' as const } : inv,
  );
  const porCobrar = enrichedInvoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + (i.amount || 0), 0);
  const overdueCount = enrichedInvoices.filter(i => i.status === 'overdue').length;

  const kpiActiveClients = clients.filter(c => c.client_stage !== 'lost' && c.client_stage !== 'dormant').length;
  const kpiTotalClients = Math.max(clients.length, 1);
  const kpiTasksTotal = projects.reduce((n, p) => n + (p.tasks || []).length, 0) || 1;

  // 5 KPIs ahora
  const kpis = [
    { label: 'Pipeline WA',       value: clients.length,       sub: `${kpiActiveClients} activos`,            color: 'oklch(0.62 0.20 250)', pct: Math.round(kpiActiveClients / kpiTotalClients * 100), href: '/admin/clients',  delay: 0 },
    { label: 'Demos pendientes',  value: pendingReview.length, sub: 'para revisar',                            color: pendingReview.length > 0 ? 'oklch(0.74 0.16 75)' : 'var(--text-3)', pct: pendingReview.length > 0 ? 100 : 0, href: '/admin/clients', delay: 60, alert: pendingReview.length > 0 },
    { label: 'Proyectos activos', value: activeProjects,       sub: `${projects.length} en total`,             color: 'oklch(0.62 0.18 290)', pct: projects.length ? Math.round(activeProjects / projects.length * 100) : 0, href: '/admin/projects', delay: 120 },
    { label: 'Tareas pendientes', value: pendingTasks,         sub: pendingTasks > 0 ? 'en proyectos' : 'al día', color: pendingTasks > 0 ? 'oklch(0.74 0.16 75)' : 'oklch(0.62 0.16 160)', pct: kpiTasksTotal ? Math.round(pendingTasks / kpiTasksTotal * 100) : 0, href: '/admin/tasks', delay: 180 },
  ];

  // KPI especial "Por cobrar" — formatARS, va al lado, no usa KPICard porque ese es para números
  const porCobrarLabel = porCobrar > 0 ? formatARS(porCobrar) : '—';

  // Pipeline funnel (todos los stages)
  const totalForFunnel = clients.length;
  const funnel = STAGES.slice(0, 6).map(s => {
    const count = clients.filter(c => c.client_stage === s.key).length;
    const pct = totalForFunnel > 0 ? Math.round(count / totalForFunnel * 100) : 0;
    return { ...s, count, pct };
  });

  // Tu próxima acción (en orden de prioridad)
  const nextAction = computeNextAction({ pendingReview, enrichedInvoices, projects, todayISO });

  // Actividad mixta — combina eventos de varias fuentes
  const events: ActivityEvent[] = [
    ...clients.slice(0, 8).map(c => {
      const stage = STAGES.find(s => s.key === c.client_stage as StageKey);
      const isDemo = c.demo_status === 'sent' || c.demo_status === 'pending_review' || c.demo_status === 'approved';
      return {
        type: (isDemo ? 'demo' : 'lead') as ActivityEvent['type'],
        title: c.report?.cliente?.nombre || c.phone,
        sub: stage?.label || c.client_stage,
        href: `/admin/client/${encodeURIComponent(c.phone)}`,
        ts: c.updated_at || '',
        color: stage?.dot || 'var(--accent)',
        Icon: isDemo ? Eye : MessageCircle,
      };
    }),
    ...enrichedInvoices.filter(i => i.status === 'paid' && i.paid_at).slice(0, 5).map(inv => ({
      type: 'invoice_paid' as const,
      title: `Cobro: ${inv.client_name || inv.number}`,
      sub: `${formatARS(inv.amount)} · ${inv.payment_method || 'pagada'}`,
      href: `/admin/facturas/${inv.id}`,
      ts: inv.paid_at + 'T12:00:00',
      color: 'oklch(0.62 0.16 160)',
      Icon: CheckCircle2,
    })),
    ...enrichedInvoices.filter(i => i.status === 'sent').slice(0, 5).map(inv => ({
      type: 'invoice_sent' as const,
      title: `Factura enviada: ${inv.client_name || inv.number}`,
      sub: `${formatARS(inv.amount)} · vence ${inv.due_date || '—'}`,
      href: `/admin/facturas/${inv.id}`,
      ts: inv.updated_at || inv.created_at || inv.issue_date + 'T12:00:00',
      color: 'oklch(0.74 0.16 75)',
      Icon: Receipt,
    })),
  ]
    .sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))
    .slice(0, 8);

  // Mini-chart cobros últimos 30 días por semana
  const incomeBuckets = buildLast4Weeks(enrichedInvoices);
  const totalRecent = incomeBuckets.reduce((s, b) => s + b.v, 0);

  // Top proyectos activos por % de tareas completadas
  const topProjects = projects
    .filter(p => ['in_progress', 'planning'].includes(p.status))
    .map(p => {
      const total = (p.tasks || []).length;
      const done = (p.tasks || []).filter(t => t.done).length;
      return { ...p, _pct: total > 0 ? Math.round((done / total) * 100) : 0, _done: done, _total: total };
    })
    .slice(0, 6);

  return (
    <div className="max-w-[1280px] mx-auto">
      <DashboardHeader
        contactsCount={clients.length}
        projectsCount={projects.length}
        pendingTasks={pendingTasks}
        pendingReview={pendingReview.length}
      />

      {/* KPIs — 5 en la grilla cuando hay facturas pendientes, sino 4 */}
      <div className={`grid grid-cols-2 ${porCobrar > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3 mb-3`}>
        {kpis.map(kpi => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
        {porCobrar > 0 && (
          <Link
            href="/admin/facturas"
            className="relative block bg-card rounded-[var(--r-lg)] border border-[var(--border)] overflow-hidden shadow-[var(--shadow-soft)] px-[18px] pt-[18px] pb-[15px] hover:-translate-y-0.5 hover:shadow-[var(--shadow-elev)] transition-all"
          >
            <div
              className="pointer-events-none absolute top-0 right-0 w-[70px] h-[70px] rounded-full"
              style={{ background: `radial-gradient(circle at 100% 0%, color-mix(in oklch, ${overdueCount > 0 ? 'oklch(0.62 0.22 27)' : 'oklch(0.62 0.16 160)'} 18%, transparent), transparent 70%)` }}
            />
            <div className="relative flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Por cobrar</span>
              <div
                className="w-[22px] h-[22px] rounded-md grid place-items-center"
                style={{ background: `color-mix(in oklch, ${overdueCount > 0 ? 'oklch(0.62 0.22 27)' : 'oklch(0.62 0.16 160)'} 13%, transparent)` }}
              >
                <DollarSign className="w-3 h-3" style={{ color: overdueCount > 0 ? 'oklch(0.62 0.22 27)' : 'oklch(0.62 0.16 160)' }} />
              </div>
            </div>
            <div className="relative mono text-[20px] font-bold leading-none text-foreground" style={{ letterSpacing: '-0.5px' }}>
              {porCobrarLabel}
            </div>
            <div className="relative mt-[7px] text-[11px] text-muted-foreground">
              {overdueCount > 0 ? <span className="text-[var(--red)]">{overdueCount} vencida{overdueCount === 1 ? '' : 's'}</span> : 'enviadas sin pagar'}
            </div>
          </Link>
        )}
      </div>

      {/* Tu próxima acción */}
      {nextAction && (
        <Link
          href={nextAction.href}
          className="block mb-3 bg-card rounded-[var(--r-lg)] border-2 border-dashed transition-all hover:border-solid hover:shadow-[var(--shadow-elev)] p-4 group"
          style={{ borderColor: nextAction.color }}
        >
          <div className="flex items-center gap-3">
            <div
              className="grid place-items-center w-10 h-10 rounded-xl flex-shrink-0"
              style={{ background: `color-mix(in oklch, ${nextAction.color} 14%, transparent)` }}
            >
              <nextAction.Icon className="w-5 h-5" style={{ color: nextAction.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Tu próxima acción</div>
              <div className="text-[14px] font-semibold text-foreground mt-0.5 truncate">{nextAction.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{nextAction.sub}</div>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] font-semibold whitespace-nowrap group-hover:translate-x-0.5 transition-transform" style={{ color: nextAction.color }}>
              {nextAction.cta}
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>
      )}

      {/* Pending review banner si hay varios */}
      {pendingReview.length > 1 && (
        <div className="bg-[oklch(0.74_0.16_75_/_0.10)] border border-[oklch(0.74_0.16_75_/_0.30)] rounded-xl px-4 py-2.5 mb-3 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[var(--amber)] flex-shrink-0" />
          <div className="flex-1 min-w-0 text-[12px] text-foreground">
            <span className="font-semibold">Hay {pendingReview.length} demos esperando revisión: </span>
            {pendingReview.slice(0, 3).map((c, i) => (
              <span key={c.phone}>
                {i > 0 && ' · '}
                <Link href={`/admin/review/${encodeURIComponent(c.phone)}`} className="underline">
                  {c.report?.cliente?.nombre || c.phone}
                </Link>
              </span>
            ))}
            {pendingReview.length > 3 && <span> y {pendingReview.length - 3} más</span>}
          </div>
        </div>
      )}

      {/* Row 1: Pipeline funnel + Actividad mixta + Cobros 4 semanas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        {/* Pipeline funnel */}
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)]">
          <div className="px-4 pt-3.5 pb-2.5 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">Pipeline WA</span>
            <Link href="/admin/clients" className="text-[11px] text-[var(--accent-strong)] hover:underline">Ver Kanban →</Link>
          </div>
          <div className="py-1.5">
            {funnel.map(stage => (
              <Link
                key={stage.key}
                href={`/admin/clients?stage=${stage.key}`}
                className="flex items-center gap-2.5 py-1.5 px-4 hover:bg-[var(--bg-inset)] transition-colors group"
              >
                <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: stage.dot }} />
                <span className="text-[12px] text-muted-foreground flex-1 truncate group-hover:text-foreground transition-colors">{stage.label}</span>
                <div className="w-[72px] h-1 rounded-sm bg-[var(--bg-inset)] overflow-hidden">
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${Math.max(stage.pct, stage.count > 0 ? 8 : 0)}%`,
                      background: stage.dot,
                      transition: 'width 1s ease',
                    }}
                  />
                </div>
                <span className="mono text-[12px] font-semibold text-foreground w-4 text-right">{stage.count}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Actividad mixta (timeline) */}
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)]">
          <div className="px-4 pt-3.5 pb-2.5 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">Actividad reciente</span>
          </div>
          {events.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-[12px] text-muted-foreground mb-2">Sin actividad todavía.</p>
              <Link href="/admin/clients" className="text-[11px] text-[var(--accent-strong)] hover:underline">Importar leads →</Link>
            </div>
          ) : (
            <ul className="py-1.5">
              {events.map((ev, i) => (
                <li key={i}>
                  <Link
                    href={ev.href}
                    className="flex items-center gap-2.5 py-1.5 px-4 hover:bg-[var(--bg-inset)] transition-colors"
                  >
                    <div
                      className="grid place-items-center w-6 h-6 rounded-md flex-shrink-0"
                      style={{ background: `color-mix(in oklch, ${ev.color} 14%, transparent)` }}
                    >
                      <ev.Icon className="w-3 h-3" style={{ color: ev.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-foreground truncate">{ev.title}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{ev.sub}</div>
                    </div>
                    <span className="mono text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(ev.ts)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Cobros últimas 4 semanas (mini-chart) */}
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)]">
          <div className="px-4 pt-3.5 pb-2.5 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
              <span className="text-[13px] font-semibold text-foreground">Cobros 4 sem</span>
            </div>
            <Link href="/admin/finanzas" className="text-[11px] text-[var(--accent-strong)] hover:underline">Finanzas →</Link>
          </div>
          <div className="px-4 py-3">
            {totalRecent > 0 ? (
              <>
                <div className="mono text-[18px] font-bold text-foreground leading-none mb-1" style={{ letterSpacing: '-0.5px' }}>
                  {formatARS(totalRecent)}
                </div>
                <div className="text-[10px] text-muted-foreground mb-3">cobrado en últimas 4 semanas</div>
                <MiniBars data={incomeBuckets} />
              </>
            ) : (
              <div className="text-center py-6">
                <div className="text-[12px] text-muted-foreground mb-2">Sin cobros en 4 semanas.</div>
                <Link href="/admin/facturas" className="text-[11px] text-[var(--accent-strong)] hover:underline">Marcar pagada →</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Proyectos activos */}
      {topProjects.length > 0 && (
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)]">
          <div className="px-4 pt-3.5 pb-2.5 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
              <span className="text-[13px] font-semibold text-foreground">Proyectos activos</span>
            </div>
            <Link href="/admin/projects" className="text-[11px] text-[var(--accent-strong)] hover:underline">Ver todos →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--border)]">
            {[topProjects.slice(0, 3), topProjects.slice(3, 6)].map((col, ci) => (
              <div key={ci} className="divide-y divide-[var(--border)]">
                {col.map(p => (
                  <Link
                    key={p.id}
                    href={`/admin/projects/${p.id}`}
                    className="block px-4 py-2.5 hover:bg-[var(--bg-inset)] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-foreground truncate">{p.title}</div>
                        {p.client_name && (
                          <div className="text-[10px] text-muted-foreground truncate">{p.client_name}</div>
                        )}
                      </div>
                      <span className="mono text-[11px] text-muted-foreground flex-shrink-0">{p._done}/{p._total} · {p._pct}%</span>
                    </div>
                    <div className="h-1 rounded-sm bg-[var(--bg-inset)] overflow-hidden">
                      <div
                        className="h-full rounded-sm bg-[var(--accent)]"
                        style={{ width: `${p._pct}%`, transition: 'width 1s ease' }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

interface NextAction {
  title: string;
  sub: string;
  cta: string;
  href: string;
  color: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

function computeNextAction(args: {
  pendingReview: { phone: string; report?: { cliente?: { nombre?: string } } | null }[];
  enrichedInvoices: { id: string; status: string; client_name: string; number: string; amount: number; due_date: string }[];
  projects: { id: string; title: string; tasks: { text: string; done?: boolean; due_date?: string }[] }[];
  todayISO: string;
}): NextAction | null {
  // Prioridad 1: factura vencida
  const overdue = args.enrichedInvoices.find(i => i.status === 'overdue');
  if (overdue) {
    return {
      title: `Factura vencida: ${overdue.client_name || overdue.number}`,
      sub: `${formatARS(overdue.amount)} · venció el ${overdue.due_date}`,
      cta: 'Cobrar',
      href: `/admin/facturas/${overdue.id}`,
      color: 'oklch(0.62 0.22 27)',
      Icon: AlertTriangle,
    };
  }
  // Prioridad 2: demo para revisar
  if (args.pendingReview.length > 0) {
    const c = args.pendingReview[0];
    return {
      title: `Revisar demo: ${c.report?.cliente?.nombre || c.phone}`,
      sub: 'El bot generó el demo. Aprobá o pedí cambios antes de enviar al cliente.',
      cta: 'Revisar',
      href: `/admin/review/${encodeURIComponent(c.phone)}`,
      color: 'oklch(0.74 0.16 75)',
      Icon: Eye,
    };
  }
  // Prioridad 3: tarea vencida
  for (const p of args.projects) {
    for (const t of (p.tasks || [])) {
      if (!t.done && t.due_date && t.due_date < args.todayISO) {
        return {
          title: `Tarea atrasada: ${t.text}`,
          sub: `${p.title} · venció el ${t.due_date}`,
          cta: 'Ver tarea',
          href: `/admin/projects/${p.id}`,
          color: 'oklch(0.62 0.22 27)',
          Icon: ListTodo,
        };
      }
    }
  }
  // Prioridad 4: tarea para hoy
  for (const p of args.projects) {
    for (const t of (p.tasks || [])) {
      if (!t.done && t.due_date === args.todayISO) {
        return {
          title: `Tarea para hoy: ${t.text}`,
          sub: `${p.title}`,
          cta: 'Ver tarea',
          href: `/admin/projects/${p.id}`,
          color: 'oklch(0.62 0.18 250)',
          Icon: Calendar,
        };
      }
    }
  }
  // Prioridad 5: factura draft sin enviar
  const draft = args.enrichedInvoices.find(i => i.status === 'draft');
  if (draft) {
    return {
      title: `Factura en borrador: ${draft.client_name || draft.number}`,
      sub: `${formatARS(draft.amount)} · falta marcar como enviada`,
      cta: 'Revisar',
      href: `/admin/facturas/${draft.id}`,
      color: 'oklch(0.62 0.18 290)',
      Icon: FileCheck,
    };
  }
  // Prioridad 6: nada urgente — mensaje motivador con próximo paso opcional
  return {
    title: 'Todo bajo control 👌',
    sub: 'No hay nada urgente. Buen momento para preparar un nuevo presupuesto o seguir un lead frío.',
    cta: 'Ir a clientes',
    href: '/admin/clients',
    color: 'oklch(0.62 0.16 160)',
    Icon: CheckCircle2,
  };
}

function buildLast4Weeks(invoices: { paid_at: string; amount: number; currency: string; status: string }[]) {
  const now = Date.now();
  const week = 7 * 86400_000;
  const buckets = [3, 2, 1, 0].map(i => ({
    label: i === 0 ? 'esta' : `${i + 1}sem`,
    v: 0,
    from: now - (i + 1) * week,
    to: now - i * week,
  }));
  for (const inv of invoices) {
    if (inv.status !== 'paid' || !inv.paid_at || inv.currency !== 'ARS') continue;
    const t = new Date(inv.paid_at + 'T12:00:00').getTime();
    const b = buckets.find(b => t >= b.from && t < b.to);
    if (b) b.v += inv.amount;
  }
  return buckets;
}

function MiniBars({ data }: { data: { label: string; v: number }[] }) {
  const max = Math.max(...data.map(d => d.v), 1);
  return (
    <div className="flex items-end gap-1.5 h-[60px]">
      {data.map((d, i) => {
        const h = Math.max(2, Math.round((d.v / max) * 56));
        const isLast = i === data.length - 1;
        return (
          <div key={d.label + i} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.label}: ${formatARS(d.v)}`}>
            <div className="w-full flex items-end" style={{ height: 56 }}>
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: h,
                  background: isLast ? 'var(--accent)' : 'color-mix(in oklch, var(--accent) 30%, var(--bg-inset))',
                }}
              />
            </div>
            <span className="mono text-[9px] text-muted-foreground">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
