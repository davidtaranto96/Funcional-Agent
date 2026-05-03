import * as db from '@/lib/db';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCheck, Trash2, X } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const all = await db.getNotifications(100);
  const unread = all.filter(n => !n.is_read);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">Notificaciones</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{all.length} totales · {unread.length} sin leer</p>
        </div>
        <div className="flex gap-2">
          {unread.length > 0 && (
            <form method="POST" action="/api/admin/notifications">
              <input type="hidden" name="action" value="read-all" />
              <Button type="submit" variant="outline" size="sm"><CheckCheck className="w-3.5 h-3.5" /> Marcar todas leídas</Button>
            </form>
          )}
          <form method="POST" action="/api/admin/notifications"
            onSubmit={e => { if (!confirm('¿Borrar todas las notificaciones leídas?')) e.preventDefault(); }}>
            <input type="hidden" name="action" value="delete-read" />
            <Button type="submit" variant="ghost" size="sm" className="text-[var(--red)]"><Trash2 className="w-3.5 h-3.5" /> Borrar leídas</Button>
          </form>
        </div>
      </div>

      {all.length === 0 ? (
        <div className="bg-card border border-dashed border-[var(--border-strong)] rounded-xl p-12 text-center">
          <p className="text-sm text-muted-foreground">Sin notificaciones.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {all.map(n => {
            const phoneEnc = n.phone ? encodeURIComponent(n.phone) : '';
            const Wrapper = n.phone
              ? ({ children }: { children: React.ReactNode }) => <Link href={`/admin/client/${phoneEnc}`} className="block">{children}</Link>
              : ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
            return (
              <li key={n.id}>
                <div className={`flex items-start gap-3 p-4 rounded-xl border ${
                  n.is_read ? 'bg-card border-[var(--border)]' : 'bg-[var(--accent-dim)] border-[var(--accent)]'
                }`}>
                  <Wrapper>
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2 ${
                        n.type === 'demo'    ? 'bg-[var(--purple)]' :
                        n.type === 'lead'    ? 'bg-[var(--accent)]' :
                        n.type === 'meeting' ? 'bg-[var(--green)]' :
                        n.type === 'warning' ? 'bg-[var(--red)]' : 'bg-[var(--text-3)]'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{n.title}</div>
                        {n.body && <div className="text-xs text-muted-foreground mt-1">{n.body}</div>}
                        <div className="text-[10px] text-muted-foreground mt-2">{timeAgo(n.created_at)}</div>
                      </div>
                    </div>
                  </Wrapper>
                  <form method="POST" action={`/api/admin/notifications/${n.id}`} className="flex-shrink-0">
                    <input type="hidden" name="action" value="delete" />
                    <button type="submit" className="text-muted-foreground hover:text-[var(--red)] p-1" aria-label="Borrar">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
