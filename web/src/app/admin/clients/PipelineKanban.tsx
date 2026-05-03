'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { STAGES, type StageKey } from '@/lib/constants';
import { showToast } from '@/components/ui/toast';
import { timeAgo } from '@/lib/utils';
import type { Conversation } from '@/lib/db';

interface Props {
  clients: Conversation[];
}

const VISIBLE_STAGES: StageKey[] = ['lead', 'qualified', 'demo_pending', 'demo_sent', 'negotiating', 'won'];

export function PipelineKanban({ clients }: Props) {
  const router = useRouter();
  const colRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    let cleanup: (() => void) | null = null;

    (async () => {
      const Sortable = (await import('sortablejs')).default;
      const instances: Array<ReturnType<typeof Sortable.create>> = [];

      colRefs.current.forEach((el) => {
        const inst = Sortable.create(el, {
          group: 'pipeline',
          animation: 200,
          ghostClass: 'opacity-40',
          dragClass: 'rotate-2',
          onEnd: async (evt) => {
            const card = evt.item;
            const newStage = (evt.to as HTMLElement).dataset.stage;
            const phone = card.dataset.phone;
            if (!phone || !newStage || newStage === evt.from.dataset.stage) return;
            try {
              const r = await fetch('/api/admin/client-stage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, newStage }),
              });
              const d = await r.json();
              if (d.ok) showToast('Etapa actualizada', 'ok');
              else { showToast('Error al actualizar', 'err'); router.refresh(); }
            } catch {
              showToast('Error de red', 'err');
              router.refresh();
            }
          },
        });
        instances.push(inst);
      });

      cleanup = () => instances.forEach(i => i.destroy());
    })();

    return () => { cleanup?.(); };
  }, [router]);

  const byStage = new Map<string, Conversation[]>();
  for (const stage of VISIBLE_STAGES) byStage.set(stage, []);
  for (const c of clients) {
    const list = byStage.get(c.client_stage) || [];
    list.push(c);
    byStage.set(c.client_stage, list);
  }

  return (
    <div className="overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6 pb-4">
      <div className="flex gap-3 min-w-max">
        {VISIBLE_STAGES.map(stageKey => {
          const stage = STAGES.find(s => s.key === stageKey)!;
          const items = byStage.get(stageKey) || [];
          return (
            <div key={stageKey} className="w-[280px] flex-shrink-0">
              <div className="flex items-center justify-between px-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: stage.dot, boxShadow: `0 0 6px ${stage.dot}` }} />
                  <span className="text-xs font-semibold text-foreground">{stage.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground mono">{items.length}</span>
              </div>
              <div
                data-stage={stageKey}
                ref={el => { if (el) colRefs.current.set(stageKey, el); }}
                className="bg-[var(--bg-inset)] rounded-lg p-2 min-h-[400px] space-y-2 border border-dashed border-transparent transition-colors"
              >
                {items.map(c => {
                  const nombre = c.report?.cliente?.nombre || c.phone;
                  const initial = nombre.charAt(0).toUpperCase();
                  const isPending = c.demo_status === 'pending_review';
                  return (
                    <Link
                      key={c.phone}
                      href={`/admin/client/${encodeURIComponent(c.phone)}`}
                      data-phone={c.phone}
                      className={`block bg-card rounded-lg p-3 cursor-grab active:cursor-grabbing border ${isPending ? 'border-[var(--amber)]' : 'border-[var(--border)]'} hover:border-[var(--border-strong)] transition-colors`}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-semibold flex-shrink-0" style={{ background: 'var(--bg-card-2)', color: 'var(--text-2)' }}>
                          {initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{nombre}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{c.phone}</div>
                        </div>
                      </div>
                      {c.report?.proyecto?.tipo && (
                        <div className="text-[10px] text-muted-foreground mb-1.5 truncate">{c.report.proyecto.tipo}</div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">{timeAgo(c.updated_at)}</span>
                        {isPending && <span className="text-[10px] text-[var(--amber)] font-semibold">Demo lista</span>}
                      </div>
                    </Link>
                  );
                })}
                {items.length === 0 && (
                  <div className="text-center text-[10px] text-muted-foreground py-8">Arrastrá contactos acá</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
