import * as db from '@/lib/db';
import Link from 'next/link';
import {
  CheckCheck, Trash2, X, Bell, Sparkles, MessageCircle, CalendarClock, AlertTriangle,
} from 'lucide-react';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TYPE_META: Record<string, { Icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  demo:    { Icon: Sparkles,      color: 'oklch(0.62 0.18 290)', label: 'Demo' },
  lead:    { Icon: MessageCircle, color: 'oklch(0.62 0.20 250)', label: 'Lead' },
  meeting: { Icon: CalendarClock, color: 'oklch(0.62 0.16 160)', label: 'Reunión' },
  warning: { Icon: AlertTriangle, color: 'oklch(0.62 0.22 27)',  label: 'Aviso' },
};

function meta(type: string) {
  return TYPE_META[type] || { Icon: Bell, color: 'oklch(0.5 0.05 250)', label: type || 'Sistema' };
}

export default async function NotificationsPage() {
  const all = await db.getNotifications(100);
  const unread = all.filter(n => !n.is_read);
  const read = all.filter(n => n.is_read);

  return (
    <div className="max-w-[800px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div
          className="grid place-items-center w-10 h-10 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] flex-shrink-0 relative"
          style={{ boxShadow: '0 4px 14px var(--accent-glow)' }}
        >
          <Bell className="w-5 h-5" />
          {unread.length > 0 && (
            <span
              className="absolute -top-1 -right-1 grid place-items-center min-w-[16px] h-4 px-1 rounded-full bg-[var(--amber)] text-[9px] font-bold text-[var(--bg)] mono"
              style={{ boxShadow: `0 0 8px var(--amber)` }}
            >
              {unread.length}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Notificaciones</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            <span className="mono">{all.length}</span> totales · <span className="mono">{unread.length}</span> sin leer
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {unread.length > 0 && (
            <form method="POST" action="/api/admin/notifications">
              <input type="hidden" name="action" value="read-all" />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[var(--bg-card-2)] border border-[var(--border)] text-[11px] font-medium text-foreground hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <CheckCheck className="w-3 h-3" /> Marcar todas leídas
              </button>
            </form>
          )}
          {read.length > 0 && (
            <form method="POST" action="/api/admin/notifications">
              <input type="hidden" name="action" value="delete-read" />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-medium text-[var(--red)] hover:bg-[oklch(0.62_0.22_27_/_0.10)] transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Borrar leídas
              </button>
            </form>
          )}
        </div>
      </div>

      {all.length === 0 ? (
        <div className="bg-card border border-dashed border-[var(--border-strong)] rounded-[var(--r-lg)] p-12 text-center">
          <div className="inline-grid place-items-center w-12 h-12 rounded-xl bg-[var(--bg-inset)] mb-4">
            <Bell className="w-6 h-6 text-muted-foreground" />
          </div>
          <h2 className="text-[15px] font-semibold text-foreground mb-1">Sin notificaciones</h2>
          <p className="text-[12px] text-muted-foreground">Cuando algo importante ocurra (demo lista, reunión, lead nuevo) aparece acá.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Sin leer */}
          {unread.length > 0 && (
            <Section label="Sin leer" count={unread.length} color="var(--accent)">
              {unread.map(n => <NotifItem key={n.id} notif={n} />)}
            </Section>
          )}

          {/* Leídas */}
          {read.length > 0 && (
            <Section label="Leídas" count={read.length} color="var(--text-3)">
              {read.map(n => <NotifItem key={n.id} notif={n} />)}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, count, color, children }: { label: string; count: number; color: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color }}>{label}</h2>
        <span className="mono text-[10px] text-muted-foreground">{count}</span>
      </div>
      <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)] overflow-hidden">
        <ul className="divide-y divide-[var(--border)]">{children}</ul>
      </div>
    </section>
  );
}

function NotifItem({ notif }: { notif: { id: string; type: string; title: string; body: string; phone: string; is_read: number; created_at?: string } }) {
  const m = meta(notif.type);
  const phoneEnc = notif.phone ? encodeURIComponent(notif.phone) : '';
  const linkable = !!notif.phone;
  const Inner = (
    <div className="flex items-start gap-3 p-3.5 hover:bg-[var(--bg-inset)] transition-colors">
      {/* Type icon */}
      <div
        className="grid place-items-center w-8 h-8 rounded-md flex-shrink-0"
        style={{ background: `color-mix(in oklch, ${m.color} 14%, transparent)`, color: m.color }}
      >
        <m.Icon className="w-3.5 h-3.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {!notif.is_read && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0"
              style={{ boxShadow: '0 0 6px var(--accent)' }}
            />
          )}
          <span className="text-[12px] font-semibold text-foreground line-clamp-1">{notif.title}</span>
          <span
            className="mono text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 flex-shrink-0"
            style={{ background: `color-mix(in oklch, ${m.color} 14%, transparent)`, color: m.color }}
          >
            {m.label}
          </span>
        </div>
        {notif.body && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{notif.body}</p>
        )}
        <div className="mono text-[10px] text-muted-foreground mt-1.5">{timeAgo(notif.created_at)}</div>
      </div>

      {/* Delete */}
      <form method="POST" action={`/api/admin/notifications/${notif.id}`} className="flex-shrink-0">
        <input type="hidden" name="action" value="delete" />
        <button
          type="submit"
          className="grid place-items-center w-7 h-7 rounded text-muted-foreground hover:text-[var(--red)] hover:bg-[oklch(0.62_0.22_27_/_0.10)] transition-colors"
          aria-label="Borrar"
          onClick={e => e.stopPropagation()}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );

  return (
    <li>
      {linkable ? (
        <Link href={`/admin/client/${phoneEnc}`}>{Inner}</Link>
      ) : Inner}
    </li>
  );
}
