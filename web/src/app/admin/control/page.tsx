import * as db from '@/lib/db';
import * as calendar from '@/lib/calendar';
import Link from 'next/link';
import {
  Activity, Bell, Calendar as CalendarIcon, MessageCircle, ListTodo, ExternalLink,
  AlertTriangle, RefreshCcw, Sparkles,
} from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import type { Task } from '@/lib/constants';
import { STAGES } from '@/lib/constants';
import { QuickControls } from './QuickControls';

export const dynamic = 'force-dynamic';

interface ServiceStatus {
  name: string;
  status: 'ok' | 'warn' | 'error';
  configured: boolean;
}

function getServices(): ServiceStatus[] {
  return [
    { name: 'Twilio',     status: process.env.TWILIO_ACCOUNT_SID ? 'ok' : 'warn', configured: !!process.env.TWILIO_ACCOUNT_SID },
    { name: 'Claude',     status: process.env.ANTHROPIC_API_KEY ? 'ok' : 'warn', configured: !!process.env.ANTHROPIC_API_KEY },
    { name: 'Groq',       status: process.env.GROQ_API_KEY ? 'ok' : 'warn',      configured: !!process.env.GROQ_API_KEY },
    { name: 'Resend',     status: process.env.RESEND_API_KEY ? 'ok' : 'warn',    configured: !!process.env.RESEND_API_KEY },
    { name: 'Google',     status: process.env.GOOGLE_CLIENT_ID ? 'ok' : 'warn',  configured: !!process.env.GOOGLE_CLIENT_ID },
  ];
}

export default async function ControlPage() {
  // listAllClientsLite() para evitar parsear history/timeline. Esta page solo
  // usa demo_status, client_stage, stage, updated_at y nombre del cliente.
  const [clients, projects, notifications, meetings] = await Promise.all([
    db.listAllClientsLite(),
    db.listProjects(),
    db.getNotifications(20),
    calendar.getUpcomingMeetings(5).catch(() => []),
  ]);

  const pendingDemos = clients.filter(c => c.demo_status === 'pending_review' && c.client_stage !== 'won' && c.client_stage !== 'lost');
  const activeConversations = clients.filter(c => ['gathering', 'confirming', 'awaiting_feedback', 'awaiting_slot'].includes(c.stage));
  const noResponse = clients
    .filter(c => c.client_stage !== 'won' && c.client_stage !== 'lost' && c.client_stage !== 'dormant')
    .filter(c => {
      if (!c.updated_at) return false;
      const days = (Date.now() - new Date(c.updated_at + 'Z').getTime()) / 86400000;
      return days >= 3 && days <= 14;
    })
    .slice(0, 5);

  const myTasks = projects
    .flatMap(p => ((p.tasks || []) as Task[]).map((t, idx) => ({ ...t, projectId: p.id, projectTitle: p.title, idx })))
    .filter(t => !t.done && (t.assignee === 'david' || !t.assignee))
    .sort((a, b) => {
      const prio: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (prio[a.priority || 'medium'] ?? 1) - (prio[b.priority || 'medium'] ?? 1);
    })
    .slice(0, 8);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const services = getServices();
  const allOk = services.every(s => s.status === 'ok');

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Banner de salud */}
      <div
        className={`bg-card border rounded-[var(--r-lg)] p-4 mb-5 shadow-[var(--shadow-soft)]`}
        style={{
          borderColor: allOk
            ? 'color-mix(in oklch, var(--green) 25%, var(--border))'
            : 'color-mix(in oklch, var(--amber) 25%, var(--border))',
        }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="grid place-items-center w-10 h-10 rounded-lg flex-shrink-0"
              style={{
                background: allOk
                  ? 'oklch(0.62 0.16 160 / 0.13)'
                  : 'oklch(0.74 0.16 75 / 0.13)',
              }}
            >
              {allOk ? (
                <Activity className="w-5 h-5 text-[var(--green)]" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-[var(--amber)]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-foreground">
                  {allOk ? 'Agente activo' : 'Servicios degradados'}
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: allOk ? 'var(--green)' : 'var(--amber)',
                    boxShadow: `0 0 8px ${allOk ? 'var(--green)' : 'var(--amber)'}`,
                    animation: 'pd-glow-breathe 2s ease-in-out infinite',
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {allOk
                  ? 'Todo corriendo bien. Twilio, Claude, Groq y Resend respondiendo.'
                  : 'Algunos servicios sin configurar. Revisá las API keys.'}
              </p>
            </div>
          </div>

          {/* Service pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {services.map(s => (
              <span
                key={s.name}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium"
                style={{
                  background: s.status === 'ok'
                    ? 'oklch(0.62 0.16 160 / 0.10)'
                    : 'oklch(0.74 0.16 75 / 0.10)',
                  color: s.status === 'ok' ? 'var(--green)' : 'var(--amber)',
                }}
                title={s.configured ? 'Configurado' : 'Sin configurar'}
              >
                <span
                  className="w-1 h-1 rounded-full"
                  style={{ background: s.status === 'ok' ? 'var(--green)' : 'var(--amber)' }}
                />
                {s.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">Centro de Control</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Operaciones del agente · Bandeja de acción · Conversaciones activas</p>
      </div>

      {/* Bandeja de acción + Reuniones */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
        <div className="lg:col-span-3">
          <SectionTitle icon={<Sparkles className="w-3.5 h-3.5" />} color="oklch(0.74 0.16 75)">
            Bandeja de acción
          </SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ActionItem
              count={pendingDemos.length}
              total="demos"
              label="Demos para aprobar"
              color="oklch(0.74 0.16 75)"
              empty={pendingDemos.length === 0}
              emptyText="Sin demos esperando"
            >
              {pendingDemos.slice(0, 3).map(c => {
                const nombre = c.clientName || c.phone;
                return (
                  <Link
                    key={c.phone}
                    href={`/admin/review/${encodeURIComponent(c.phone)}`}
                    className="flex items-center justify-between text-[11px] text-foreground hover:text-[var(--amber)] py-1 transition-colors"
                  >
                    <span className="truncate">{nombre}</span>
                    <span className="text-[var(--amber)] flex-shrink-0 ml-2">→</span>
                  </Link>
                );
              })}
            </ActionItem>

            <ActionItem
              count={noResponse.length}
              total="leads"
              label="Sin respuesta hace +3d"
              color="oklch(0.62 0.18 250)"
              empty={noResponse.length === 0}
              emptyText="Todos respondieron"
            >
              {noResponse.slice(0, 3).map(c => {
                const nombre = c.clientName || c.phone;
                return (
                  <Link
                    key={c.phone}
                    href={`/admin/client/${encodeURIComponent(c.phone)}`}
                    className="flex items-center justify-between text-[11px] text-foreground hover:text-[var(--accent-strong)] py-1 transition-colors"
                  >
                    <span className="truncate">{nombre}</span>
                    <span className="text-muted-foreground mono text-[10px] flex-shrink-0 ml-2">{timeAgo(c.updated_at)}</span>
                  </Link>
                );
              })}
            </ActionItem>
          </div>

          {/* Quick actions */}
          <div className="mt-4">
            <SectionTitle icon={<RefreshCcw className="w-3.5 h-3.5" />} color="oklch(0.62 0.18 290)">
              Controles rápidos
            </SectionTitle>
            <QuickControls defaultPhone={activeConversations[0]?.phone || pendingDemos[0]?.phone} />
          </div>
        </div>

        <div className="lg:col-span-2">
          {/* Próximas reuniones */}
          <SectionTitle icon={<CalendarIcon className="w-3.5 h-3.5" />} color="oklch(0.62 0.18 290)">
            Próximas reuniones
          </SectionTitle>
          <div className="bg-card border border-[var(--border)] rounded-[var(--r-lg)] shadow-[var(--shadow-soft)] overflow-hidden">
            {meetings.length === 0 ? (
              <p className="text-[12px] text-muted-foreground p-4">Sin reuniones agendadas.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {meetings.map(m => {
                  const start = new Date(m.start);
                  const isToday = start.toDateString() === new Date().toDateString();
                  return (
                    <li key={m.id || m.start} className="p-3.5">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="text-[12px] font-semibold text-foreground truncate flex-1 min-w-0">{m.summary}</div>
                        {isToday && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--accent)] bg-[var(--accent-dim)] rounded px-1.5 py-0.5 flex-shrink-0">
                            Hoy
                          </span>
                        )}
                      </div>
                      <div className="mono text-[10px] text-muted-foreground mb-2">
                        {start.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' · '}
                        {start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {m.meetLink && (
                        <a
                          href={m.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--accent)] text-white text-[10px] font-semibold rounded-md hover:brightness-110 transition-all"
                        >
                          <ExternalLink className="w-2.5 h-2.5" /> Google Meet
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Conversaciones + Tareas + Notif */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Conversaciones activas */}
        <div className="lg:col-span-1">
          <SectionTitle icon={<MessageCircle className="w-3.5 h-3.5" />} color="oklch(0.62 0.16 160)">
            Conversaciones activas
          </SectionTitle>
          <div className="bg-card border border-[var(--border)] rounded-[var(--r-lg)] shadow-[var(--shadow-soft)] overflow-hidden">
            {activeConversations.length === 0 ? (
              <p className="text-[12px] text-muted-foreground p-4">Sin conversaciones en curso.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {activeConversations.slice(0, 6).map(c => {
                  const nombre = c.clientName || c.phone;
                  const stage = STAGES.find(s => s.key === c.client_stage);
                  return (
                    <li key={c.phone}>
                      <Link
                        href={`/admin/client/${encodeURIComponent(c.phone)}`}
                        className="flex items-center gap-2.5 p-3 hover:bg-[var(--bg-inset)] transition-colors"
                      >
                        <div className="relative flex-shrink-0">
                          <div
                            className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold text-white"
                            style={{ background: stage?.dot || 'var(--bg-card-2)' }}
                          >
                            {nombre.charAt(0).toUpperCase()}
                          </div>
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--green)] border border-card"
                            style={{ boxShadow: '0 0 4px var(--green)' }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium text-foreground truncate">{nombre}</div>
                          <div className="mono text-[10px] text-muted-foreground">{timeAgo(c.updated_at)}</div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Mis tareas */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <SectionTitle icon={<ListTodo className="w-3.5 h-3.5" />} color="oklch(0.62 0.20 250)">
              Mis tareas
            </SectionTitle>
            <Link href="/admin/tasks" className="text-[11px] text-[var(--accent-strong)] hover:underline -mt-1">Ver todas →</Link>
          </div>
          <div className="bg-card border border-[var(--border)] rounded-[var(--r-lg)] shadow-[var(--shadow-soft)] overflow-hidden">
            {myTasks.length === 0 ? (
              <p className="text-[12px] text-muted-foreground p-4">¡Sin tareas pendientes! 🎉</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {myTasks.map(t => (
                  <li key={`${t.projectId}-${t.idx}`}>
                    <Link
                      href={`/admin/projects/${t.projectId}`}
                      className="flex items-start gap-2 p-3 hover:bg-[var(--bg-inset)] transition-colors"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                        style={{
                          background:
                            t.priority === 'high' ? 'oklch(0.62 0.22 27)' :
                            t.priority === 'medium' ? 'oklch(0.74 0.16 75)' :
                            'oklch(0.5 0.05 250)',
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-foreground line-clamp-2 leading-snug">{t.text}</div>
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">{t.projectTitle}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Notificaciones */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <SectionTitle icon={<Bell className="w-3.5 h-3.5" />} color="oklch(0.74 0.16 75)">
              Notificaciones
              {unreadCount > 0 && (
                <span className="ml-1.5 mono text-[9px] bg-[var(--amber)] text-[var(--bg)] rounded px-1.5 py-0.5">
                  {unreadCount}
                </span>
              )}
            </SectionTitle>
            <Link href="/admin/notifications" className="text-[11px] text-[var(--accent-strong)] hover:underline -mt-1">Ver todas →</Link>
          </div>
          <div className="bg-card border border-[var(--border)] rounded-[var(--r-lg)] shadow-[var(--shadow-soft)] overflow-hidden">
            {notifications.length === 0 ? (
              <p className="text-[12px] text-muted-foreground p-4">Sin notificaciones.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {notifications.slice(0, 5).map(n => (
                  <li key={n.id} className={`p-3 ${!n.is_read ? 'bg-[var(--accent-dim)]' : ''}`}>
                    <div className="flex items-start gap-2">
                      {!n.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0 mt-1.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-foreground line-clamp-1">{n.title}</div>
                        {n.body && <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
                        <div className="mono text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, color, children }: { icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <div
        className="grid place-items-center w-5 h-5 rounded"
        style={{ background: `color-mix(in oklch, ${color} 14%, transparent)`, color }}
      >
        {icon}
      </div>
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color }}>
        {children}
      </h2>
    </div>
  );
}

function ActionItem({
  count, total, label, color, empty, emptyText, children,
}: {
  count: number; total: string; label: string; color: string;
  empty: boolean; emptyText: string; children?: React.ReactNode;
}) {
  return (
    <div
      className="bg-card border-l-[3px] border border-[var(--border)] rounded-[var(--r-md)] p-3.5 shadow-[var(--shadow-soft)]"
      style={{ borderLeftColor: empty ? 'var(--border-strong)' : color }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {!empty && (
          <span
            className="mono text-[10px] font-bold rounded px-1.5 py-0.5"
            style={{ background: `color-mix(in oklch, ${color} 18%, transparent)`, color }}
          >
            {count} {total}
          </span>
        )}
      </div>
      {empty ? (
        <p className="text-[11px] text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-0.5">{children}</div>
      )}
    </div>
  );
}

