import * as db from '@/lib/db';
import * as calendar from '@/lib/calendar';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StageBadge } from '@/components/admin/StageBadge';
import { Activity, Bell, Calendar as CalendarIcon, MessageCircle, ListTodo, ExternalLink, Trash2 } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import type { Task } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function ControlPage() {
  const [clients, projects, notifications, meetings] = await Promise.all([
    db.listAllClients(),
    db.listProjects(),
    db.getNotifications(20),
    calendar.getUpcomingMeetings(5).catch(() => []),
  ]);

  const pendingDemos = clients.filter(c => c.demo_status === 'pending_review' && c.client_stage !== 'won' && c.client_stage !== 'lost');
  const activeConversations = clients.filter(c => ['gathering', 'confirming', 'awaiting_feedback', 'awaiting_slot'].includes(c.stage));
  const myTasks = projects
    .flatMap(p => ((p.tasks || []) as Task[]).map((t, idx) => ({ ...t, projectId: p.id, projectTitle: p.title, idx })))
    .filter(t => !t.done && (t.assignee === 'david' || !t.assignee))
    .sort((a, b) => {
      const prio: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (prio[a.priority || 'medium'] ?? 1) - (prio[b.priority || 'medium'] ?? 1);
    })
    .slice(0, 8);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const services = ['Twilio', 'Claude', 'Resend', 'Drive'];

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">Centro de Control</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs"
              style={{ background: 'oklch(0.62 0.16 160 / 0.13)', color: 'var(--green)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse" />
              Agente activo
            </span>
            <span className="text-[10px] text-muted-foreground">{services.join(' · ')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Acciones + Conversaciones (3/5) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Pending demos */}
          <Section
            title="Acciones pendientes"
            icon={<Activity className="w-4 h-4 text-[var(--amber)]" />}
            count={pendingDemos.length}
          >
            {pendingDemos.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">✅ Sin acciones pendientes.</p>
            ) : (
              <ul className="space-y-2">
                {pendingDemos.map(c => {
                  const nombre = c.report?.cliente?.nombre || c.phone;
                  return (
                    <li key={c.phone}>
                      <Link href={`/admin/review/${encodeURIComponent(c.phone)}`}
                        className="flex items-center justify-between p-3 bg-[var(--bg-inset)] rounded-md hover:bg-[var(--bg-card-2)] transition-colors">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{nombre}</div>
                          <div className="text-[10px] text-muted-foreground">Demo lista para revisar</div>
                        </div>
                        <span className="text-xs text-[var(--amber)] font-semibold flex-shrink-0">Revisar →</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* Active conversations */}
          <Section
            title="Conversaciones activas"
            icon={<MessageCircle className="w-4 h-4 text-[var(--accent-strong)]" />}
            count={activeConversations.length}
          >
            {activeConversations.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">Sin conversaciones activas.</p>
            ) : (
              <ul className="space-y-2">
                {activeConversations.slice(0, 6).map(c => {
                  const nombre = c.report?.cliente?.nombre || c.phone;
                  return (
                    <li key={c.phone}>
                      <Link href={`/admin/client/${encodeURIComponent(c.phone)}`}
                        className="flex items-center gap-2.5 p-2 hover:bg-[var(--bg-inset)] rounded-md transition-colors">
                        <div className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-semibold flex-shrink-0" style={{ background: 'var(--bg-card-2)', color: 'var(--text-2)' }}>
                          {nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{nombre}</div>
                          <div className="text-[10px] text-muted-foreground">{timeAgo(c.updated_at)}</div>
                        </div>
                        <StageBadge stage={c.client_stage} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>

        {/* Right: Reuniones + Tareas + Notificaciones (2/5) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Próximas reuniones */}
          <Section
            title="Próximas reuniones"
            icon={<CalendarIcon className="w-4 h-4 text-[var(--purple)]" />}
            count={meetings.length}
          >
            {meetings.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">Sin reuniones agendadas.</p>
            ) : (
              <ul className="space-y-3">
                {meetings.map(m => {
                  const start = new Date(m.start);
                  const isToday = start.toDateString() === new Date().toDateString();
                  return (
                    <li key={m.id || m.start}
                      className={`p-3 rounded-md border ${isToday ? 'bg-[var(--accent-dim)] border-[var(--accent)]' : 'bg-[var(--bg-inset)] border-[var(--border)]'}`}>
                      <div className="text-xs font-medium text-foreground truncate mb-1">{m.summary}</div>
                      <div className="text-[10px] text-muted-foreground mb-2">
                        {start.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' · '}
                        {start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {m.meetLink && (
                        <a href={m.meetLink} target="_blank" rel="noopener"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--accent)] text-primary-foreground text-[10px] font-semibold rounded-md hover:opacity-90">
                          <ExternalLink className="w-3 h-3" /> Google Meet
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* Mis tareas */}
          <Section
            title="Mis tareas"
            icon={<ListTodo className="w-4 h-4 text-[var(--green)]" />}
            count={myTasks.length}
            actionHref="/admin/tasks"
            actionLabel="Ver todas"
          >
            {myTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">Sin tareas pendientes 🎉</p>
            ) : (
              <ul className="space-y-1.5">
                {myTasks.map(t => (
                  <li key={`${t.projectId}-${t.idx}`}>
                    <Link href={`/admin/projects/${t.projectId}`} className="flex items-start gap-2 p-2 rounded-md hover:bg-[var(--bg-inset)] transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                        t.priority === 'high' ? 'bg-[var(--red)]' :
                        t.priority === 'medium' ? 'bg-[var(--amber)]' : 'bg-[var(--text-3)]'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-foreground">{t.text}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{t.projectTitle}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Notificaciones */}
          <Section
            title="Notificaciones"
            icon={<Bell className="w-4 h-4 text-[var(--accent-strong)]" />}
            count={unreadCount}
            actionHref="/admin/notifications"
            actionLabel="Ver todas"
          >
            {notifications.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">Sin notificaciones.</p>
            ) : (
              <ul className="space-y-1.5">
                {notifications.slice(0, 5).map(n => (
                  <li key={n.id} className={`p-2 rounded-md ${!n.is_read ? 'bg-[var(--accent-dim)]' : ''}`}>
                    <div className="text-xs font-medium text-foreground">{n.title}</div>
                    {n.body && <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
                    <div className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, count, children, actionHref, actionLabel }: {
  title: string; icon: React.ReactNode; count?: number; children: React.ReactNode; actionHref?: string; actionLabel?: string;
}) {
  return (
    <div className="bg-card border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-[length:var(--h2-size)] font-semibold">{title}</h2>
          {count !== undefined && <span className="text-[10px] text-muted-foreground mono">{count}</span>}
        </div>
        {actionHref && (
          <Link href={actionHref} className="text-xs text-[var(--accent-strong)] hover:underline">{actionLabel} →</Link>
        )}
      </div>
      {children}
    </div>
  );
}
