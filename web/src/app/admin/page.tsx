import * as db from '@/lib/db';
import { STAGES, type StageKey } from '@/lib/constants';
import { KPICard } from '@/components/admin/KPICard';
import { Badge } from '@/components/ui/badge';
import { timeAgo } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [clients, projects] = await Promise.all([
    db.listAllClients(),
    db.listProjects(),
  ]);

  const pendingReview = clients.filter(c => c.demo_status === 'pending_review');
  const activeProjects = projects.filter(p =>
    ['planning', 'in_progress', 'waiting_client', 'waiting_payment', 'review'].includes(p.status),
  ).length;
  const pendingTasks = projects.reduce((n, p) => n + (p.tasks || []).filter(t => !(t as { done?: boolean }).done).length, 0);

  const kpiActiveClients = clients.filter(c => c.client_stage !== 'lost' && c.client_stage !== 'dormant').length;
  const kpiTotalClients = Math.max(clients.length, 1);
  const kpiTasksTotal = projects.reduce((n, p) => n + (p.tasks || []).length, 0) || 1;

  const kpis = [
    { label: 'Pipeline WA', value: clients.length, sub: `${kpiActiveClients} activos`, color: 'var(--accent)', pct: Math.round(kpiActiveClients / kpiTotalClients * 100), href: '/admin/clients', delay: 0 },
    { label: 'Demos pendientes', value: pendingReview.length, sub: 'para revisar', color: pendingReview.length > 0 ? 'var(--amber)' : 'var(--text-3)', pct: pendingReview.length > 0 ? 100 : 0, href: '/admin/clients', delay: 80, alert: pendingReview.length > 0 },
    { label: 'Proyectos activos', value: activeProjects, sub: `${projects.length} en total`, color: 'var(--purple)', pct: projects.length ? Math.round(activeProjects / projects.length * 100) : 0, href: '/admin/projects', delay: 160 },
    { label: 'Tareas pendientes', value: pendingTasks, sub: pendingTasks > 0 ? 'en proyectos' : 'al día', color: pendingTasks > 0 ? 'var(--amber)' : 'var(--green)', pct: kpiTasksTotal ? Math.round(pendingTasks / kpiTasksTotal * 100) : 0, href: '/admin/tasks', delay: 240 },
  ];

  // Pipeline funnel
  const totalForFunnel = clients.length;
  const funnel = STAGES.slice(0, 6).map(s => {
    const count = clients.filter(c => c.client_stage === s.key).length;
    const pct = totalForFunnel > 0 ? Math.round(count / totalForFunnel * 100) : 0;
    return { ...s, count, pct };
  });

  // Última actividad
  const recent = clients.slice(0, 8);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">
          Buenos días, David
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {clients.length} contactos en pipeline · {projects.length} proyectos · {pendingTasks} tareas pendientes
        </p>
      </div>

      {/* Pending review alert */}
      {pendingReview.length > 0 && (
        <div className="bg-[oklch(0.74_0.16_75_/_0.10)] border border-[oklch(0.74_0.16_75_/_0.30)] rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[var(--amber)] flex-shrink-0" />
          <div className="flex-1 min-w-0 text-sm text-foreground">
            <span className="font-semibold">Demos esperando revisión: </span>
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
          <Link
            href={`/admin/review/${encodeURIComponent(pendingReview[0].phone)}`}
            className="flex-shrink-0 inline-flex items-center gap-1 bg-[var(--amber)] text-[var(--bg)] text-xs font-semibold px-3 py-1.5 rounded-md"
          >
            Revisar →
          </Link>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {kpis.map(kpi => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Pipeline + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Pipeline funnel */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[length:var(--h2-size)] font-semibold tracking-tight">Pipeline WA</h2>
            <Link href="/admin/clients" className="text-xs text-[var(--accent-strong)] hover:underline">Ver todo →</Link>
          </div>
          <div className="space-y-2">
            {funnel.map(stage => (
              <Link
                key={stage.key}
                href={`/admin/clients?stage=${stage.key}`}
                className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-md hover:bg-[var(--bg-inset)] transition-colors group"
              >
                <div className="text-xs text-muted-foreground w-32 truncate group-hover:text-foreground transition-colors">{stage.label}</div>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-inset)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(stage.pct, stage.count > 0 ? 8 : 0)}%`, background: stage.dot }}
                  />
                </div>
                <div className="mono text-xs text-muted-foreground w-10 text-right">{stage.count}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-card rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[length:var(--h2-size)] font-semibold tracking-tight">Actividad reciente</h2>
          </div>
          {recent.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin actividad todavía. Cuando lleguen mensajes a tu WhatsApp, aparecen acá.</p>
          ) : (
            <ul className="space-y-2.5">
              {recent.map(c => {
                const stage = STAGES.find(s => s.key === c.client_stage as StageKey);
                return (
                  <li key={c.phone}>
                    <Link
                      href={`/admin/client/${encodeURIComponent(c.phone)}`}
                      className="flex items-center gap-2.5 py-1 px-2 -mx-2 rounded-md hover:bg-[var(--bg-inset)] transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-semibold flex-shrink-0" style={{ background: 'var(--bg-card-2)', color: 'var(--text-2)' }}>
                        {(c.report?.cliente?.nombre || c.phone).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">
                          {c.report?.cliente?.nombre || c.phone}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{timeAgo(c.updated_at)}</div>
                      </div>
                      {stage && (
                        <Badge variant="outline" className="text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: stage.dot }} />
                          {stage.label}
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Placeholder for next-session pages */}
      <div className="mt-8 p-5 bg-[var(--bg-inset)] rounded-xl border border-dashed border-[var(--border-strong)] text-center">
        <p className="text-xs text-muted-foreground">
          Esta es una vista <strong className="text-foreground">v5.0.0-alpha</strong> del nuevo panel en Next.js.
          El admin completo (pipeline, proyectos, tareas, finanzas, etc.) sigue corriendo en{' '}
          <Link href="/" className="text-[var(--accent-strong)] hover:underline">/admin</Link> del Express legacy
          mientras se completa la migración.
        </p>
      </div>
    </div>
  );
}
