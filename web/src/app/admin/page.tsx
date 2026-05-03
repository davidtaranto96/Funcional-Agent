import * as db from '@/lib/db';
import { STAGES, type StageKey } from '@/lib/constants';
import { KPICard } from '@/components/admin/KPICard';
import { DashboardHeader } from '@/components/admin/DashboardHeader';
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
    { label: 'Pipeline WA',       value: clients.length,       sub: `${kpiActiveClients} activos`,       color: 'oklch(0.62 0.20 250)', pct: Math.round(kpiActiveClients / kpiTotalClients * 100), href: '/admin/clients',  delay: 0 },
    { label: 'Demos pendientes',  value: pendingReview.length, sub: 'para revisar',                       color: pendingReview.length > 0 ? 'oklch(0.74 0.16 75)' : 'var(--text-3)', pct: pendingReview.length > 0 ? 100 : 0, href: '/admin/clients', delay: 80, alert: pendingReview.length > 0 },
    { label: 'Proyectos activos', value: activeProjects,       sub: `${projects.length} en total`,        color: 'oklch(0.62 0.18 290)', pct: projects.length ? Math.round(activeProjects / projects.length * 100) : 0, href: '/admin/projects', delay: 160 },
    { label: 'Tareas pendientes', value: pendingTasks,         sub: pendingTasks > 0 ? 'en proyectos' : 'al día', color: pendingTasks > 0 ? 'oklch(0.74 0.16 75)' : 'oklch(0.62 0.16 160)', pct: kpiTasksTotal ? Math.round(pendingTasks / kpiTasksTotal * 100) : 0, href: '/admin/tasks', delay: 240 },
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

  // Próximas deadlines (de tareas con due_date)
  const upcoming = projects
    .flatMap(p =>
      (p.tasks || [])
        .filter(t => !t.done && t.due_date)
        .map(t => ({
          title: t.text,
          due: t.due_date as string,
          project: p.title,
        })),
    )
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 5);

  // Top proyectos activos por tareas
  const topProjects = projects
    .filter(p => ['in_progress', 'planning'].includes(p.status))
    .map(p => {
      const total = (p.tasks || []).length;
      const done = (p.tasks || []).filter(t => t.done).length;
      return { ...p, _pct: total > 0 ? Math.round((done / total) * 100) : 0, _done: done, _total: total };
    })
    .slice(0, 4);

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-[1280px] mx-auto">
      {/* Header con saludo + pills */}
      <DashboardHeader
        contactsCount={clients.length}
        projectsCount={projects.length}
        pendingTasks={pendingTasks}
        pendingReview={pendingReview.length}
      />

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-[18px]">
        {kpis.map(kpi => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Row 1: Pipeline funnel + Próximas deadlines + Actividad reciente */}
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

        {/* Próximas deadlines */}
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)]">
          <div className="px-4 pt-3.5 pb-2.5 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">Próximas deadlines</span>
            <Link href="/admin/tasks" className="text-[11px] text-[var(--accent-strong)] hover:underline">Ver todas →</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-[12px] text-muted-foreground p-4">Sin deadlines configuradas.</p>
          ) : (
            <ul className="py-1.5">
              {upcoming.map((t, i) => {
                const overdue = t.due < todayISO;
                return (
                  <li key={i} className="flex items-center gap-2.5 py-1.5 px-4 hover:bg-[var(--bg-inset)] transition-colors">
                    <span
                      className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                      style={{ background: overdue ? 'oklch(0.62 0.22 27)' : 'var(--text-3)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-foreground truncate">{t.title}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{t.project}</div>
                    </div>
                    <span
                      className="mono text-[10px] whitespace-nowrap"
                      style={{ color: overdue ? 'oklch(0.62 0.22 27)' : 'var(--text-3)' }}
                    >
                      {t.due.split('-').reverse().join('/')}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Actividad reciente */}
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)]">
          <div className="px-4 pt-3.5 pb-2.5 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">Actividad reciente</span>
          </div>
          {recent.length === 0 ? (
            <p className="text-[12px] text-muted-foreground p-4">Sin actividad todavía.</p>
          ) : (
            <ul className="py-1.5">
              {recent.slice(0, 5).map(c => {
                const stage = STAGES.find(s => s.key === c.client_stage as StageKey);
                return (
                  <li key={c.phone}>
                    <Link
                      href={`/admin/client/${encodeURIComponent(c.phone)}`}
                      className="flex items-center gap-2.5 py-1.5 px-4 hover:bg-[var(--bg-inset)] transition-colors"
                    >
                      <div
                        className="w-[26px] h-[26px] rounded-full grid place-items-center text-[10px] font-bold flex-shrink-0 text-white"
                        style={{ background: stage?.dot || 'var(--bg-card-2)' }}
                      >
                        {(c.report?.cliente?.nombre || c.phone).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-foreground truncate">
                          {c.report?.cliente?.nombre || c.phone}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{timeAgo(c.updated_at)}</div>
                      </div>
                      {stage && (
                        <Badge variant="outline" className="text-[9px] uppercase tracking-wider px-1.5 py-px">
                          <span className="w-1 h-1 rounded-full mr-1" style={{ background: stage.dot }} />
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

      {/* Row 2: Proyectos activos */}
      {topProjects.length > 0 && (
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)]">
          <div className="px-4 pt-3.5 pb-2.5 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">Proyectos activos</span>
            <Link href="/admin/projects" className="text-[11px] text-[var(--accent-strong)] hover:underline">Ver todos →</Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {topProjects.map(p => (
              <Link
                key={p.id}
                href={`/admin/projects`}
                className="block px-4 py-2.5 hover:bg-[var(--bg-inset)] transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5 gap-3">
                  <span className="text-[12px] font-medium text-foreground truncate flex-1 min-w-0">{p.title}</span>
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
        </div>
      )}
    </div>
  );
}
