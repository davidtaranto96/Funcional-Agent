'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, MessageCircle, ArrowRight, FolderPlus, Archive, Eye } from 'lucide-react';
import { STAGES, type StageKey } from '@/lib/constants';
import { showToast } from '@/components/ui/toast';
import { confirmDialog } from '@/components/admin/ConfirmModal';
import { timeAgo, clientDisplayName } from '@/lib/utils';
import { Drawer } from '@/components/admin/Drawer';
import type { Conversation } from '@/lib/db';

interface Props {
  clients: Conversation[];
  view: 'kanban' | 'list';
  sort: 'recent' | 'oldest' | 'name' | 'stage';
  search: string;
  stageFilter: string;
  showArchived: boolean;
}

const VISIBLE_STAGES: StageKey[] = ['lead', 'qualified', 'demo_pending', 'demo_sent', 'negotiating', 'won'];

// "Steps" del proceso (mirror del legacy processSteps).
function processSteps(c: Conversation) {
  const ds = c.demo_status || 'none';
  const hasEvent = (e: string) => (c.timeline || []).some(x => x.event === e);
  return [
    { label: 'Conversación iniciada',  done: true },
    { label: 'Datos recopilados',      done: c.stage === 'done' || !!c.report },
    { label: 'Reporte generado',       done: !!c.report },
    { label: 'Demo generado',          done: !!ds && !['none', 'generating'].includes(ds) },
    { label: 'Aprobado',               done: ['approved', 'sent'].includes(ds), warn: ['changes_requested', 'rejected'].includes(ds) },
    { label: 'Enviado al cliente',     done: ds === 'sent' || hasEvent('demo_sent_to_client') },
    { label: 'Reunión / negociación',  done: ['negotiating', 'won'].includes(c.client_stage) },
    { label: 'Proyecto ganado',        done: c.client_stage === 'won' },
  ];
}

export function PipelineKanban({ clients: initial, view, sort, search: initialSearch, stageFilter, showArchived }: Props) {
  const router = useRouter();
  const [clients, setClients] = useState(initial);
  const [search, setSearch] = useState(initialSearch);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const colRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => { setClients(initial); }, [initial]);
  useEffect(() => { setSearch(initialSearch); }, [initialSearch]);

  // Drag-and-drop con sortablejs (kanban only)
  useEffect(() => {
    if (view !== 'kanban') return;
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
              if (d.ok) {
                showToast('Etapa actualizada', 'ok');
                setClients(cs => cs.map(c => c.phone === phone ? { ...c, client_stage: newStage } : c));
              } else {
                showToast('Error al actualizar', 'err');
                router.refresh();
              }
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
  }, [router, view]);

  // Sort + filter + search
  const filteredClients = useMemo(() => {
    let list = [...clients];

    // Sort
    if (sort === 'oldest') list.sort((a, b) => (a.updated_at || '').localeCompare(b.updated_at || ''));
    else if (sort === 'name') list.sort((a, b) => {
      const na = (a.report?.cliente?.nombre || a.phone).toLowerCase();
      const nb = (b.report?.cliente?.nombre || b.phone).toLowerCase();
      return na.localeCompare(nb);
    });
    else if (sort === 'stage') list.sort((a, b) => {
      const ai = STAGES.findIndex(s => s.key === a.client_stage);
      const bi = STAGES.findIndex(s => s.key === b.client_stage);
      return ai - bi;
    });
    else list.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

    // Stage filter
    if (stageFilter && stageFilter !== 'all') {
      list = list.filter(c => c.client_stage === stageFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => {
        const name = (c.report?.cliente?.nombre || '').toLowerCase();
        const phone = c.phone.toLowerCase();
        const tipo = (c.report?.proyecto?.tipo || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || tipo.includes(q);
      });
    }

    return list;
  }, [clients, search, sort, stageFilter]);

  const byStage = useMemo(() => {
    const m = new Map<string, Conversation[]>();
    for (const stage of VISIBLE_STAGES) m.set(stage, []);
    for (const c of filteredClients) {
      const list = m.get(c.client_stage) || [];
      list.push(c);
      m.set(c.client_stage, list);
    }
    return m;
  }, [filteredClients]);

  // Stage filter pills (counts del SET COMPLETO no filtrado por stage)
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    let preStage = clients;
    if (search.trim()) {
      const q = search.toLowerCase();
      preStage = clients.filter(c => {
        const name = (c.report?.cliente?.nombre || '').toLowerCase();
        return name.includes(q) || c.phone.toLowerCase().includes(q) || (c.report?.proyecto?.tipo || '').toLowerCase().includes(q);
      });
    }
    counts.all = preStage.length;
    for (const s of STAGES) {
      counts[s.key] = preStage.filter(c => c.client_stage === s.key).length;
    }
    return counts;
  }, [clients, search]);

  return (
    <>
      {/* Search bar */}
      <form
        method="GET"
        action="/admin/clients"
        className="relative mb-3"
      >
        <input type="hidden" name="view" value={view} />
        {sort !== 'recent' && <input type="hidden" name="sort" value={sort} />}
        {showArchived && <input type="hidden" name="archived" value="1" />}
        {stageFilter && <input type="hidden" name="stage" value={stageFilter} />}
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          name="q"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono o proyecto…"
          className="w-full h-10 pl-10 pr-3 rounded-[var(--r-md)] bg-[var(--bg-input)] border border-[var(--border)] text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)] transition-colors"
        />
      </form>

      {/* Stage filter pills */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <FilterPill href={buildHref({ view, sort, search, showArchived, stage: '' })} active={!stageFilter || stageFilter === 'all'} count={stageCounts.all}>
          Todos
        </FilterPill>
        {STAGES.filter(s => s.key !== 'dormant').map(s => (
          <FilterPill
            key={s.key}
            href={buildHref({ view, sort, search, showArchived, stage: s.key })}
            active={stageFilter === s.key}
            count={stageCounts[s.key] || 0}
            color={s.dot}
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full" style={{ background: s.dot }} />
              {s.label}
            </span>
          </FilterPill>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground mono self-center">
          {filteredClients.length} resultado{filteredClients.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* View */}
      {view === 'kanban' ? (
        <div className="overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6 pb-4">
          <div className="flex gap-3 min-w-max">
            {VISIBLE_STAGES.map(stageKey => {
              const stage = STAGES.find(s => s.key === stageKey)!;
              const items = byStage.get(stageKey) || [];
              return (
                <div key={stageKey} className="w-[280px] flex-shrink-0">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: stage.dot, boxShadow: `0 0 8px ${stage.dot}` }} />
                      <span className="text-[12px] font-semibold text-foreground">{stage.label}</span>
                    </div>
                    <span
                      className="mono text-[10px] font-semibold text-muted-foreground rounded-full px-1.5 py-0.5"
                      style={{ background: 'color-mix(in oklch, var(--bg-inset) 80%, transparent)' }}
                    >
                      {items.length}
                    </span>
                  </div>
                  <div
                    data-stage={stageKey}
                    ref={el => { if (el) colRefs.current.set(stageKey, el); }}
                    className="bg-[var(--bg-inset)] rounded-[var(--r-md)] p-2 min-h-[400px] space-y-2 border border-dashed border-transparent hover:border-[var(--border-strong)] transition-colors"
                  >
                    {items.map(c => {
                      const nombre = clientDisplayName({
                        nickname: c.nickname,
                        reportName: c.report?.cliente?.nombre,
                        phone: c.phone,
                      });
                      const initial = nombre.charAt(0).toUpperCase();
                      const isPending = c.demo_status === 'pending_review';
                      const tipo = c.report?.proyecto?.tipo;
                      return (
                        <button
                          key={c.phone}
                          type="button"
                          data-phone={c.phone}
                          onClick={() => setSelected(c)}
                          className={`w-full text-left bg-card rounded-[var(--r-md)] p-3 cursor-grab active:cursor-grabbing border transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] ${
                            isPending ? 'border-[var(--amber)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <div
                              className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold flex-shrink-0 text-white"
                              style={{ background: stage.dot }}
                            >
                              {initial}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] font-medium text-foreground truncate">{nombre}</div>
                              <div className="mono text-[10px] text-muted-foreground truncate">{c.phone}</div>
                            </div>
                          </div>
                          {tipo && <div className="text-[11px] text-muted-foreground mb-1.5 truncate">{tipo}</div>}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{timeAgo(c.updated_at)}</span>
                            {isPending && (
                              <span className="text-[10px] font-bold text-[var(--amber)] uppercase tracking-wider">Demo lista</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {items.length === 0 && (
                      <div className="text-center text-[10px] text-muted-foreground py-8 px-2">Arrastrá contactos acá</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <ListView clients={filteredClients} onSelect={setSelected} />
      )}

      <LeadDrawer client={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function buildHref(opts: { view: string; sort: string; search: string; showArchived: boolean; stage: string }) {
  const params = new URLSearchParams();
  if (opts.view !== 'kanban') params.set('view', opts.view);
  if (opts.sort !== 'recent') params.set('sort', opts.sort);
  if (opts.showArchived) params.set('archived', '1');
  if (opts.search) params.set('q', opts.search);
  if (opts.stage) params.set('stage', opts.stage);
  const q = params.toString();
  return `/admin/clients${q ? '?' + q : ''}`;
}

function FilterPill({ href, active, count, color, children }: {
  href: string; active: boolean; count: number; color?: string; children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
        active
          ? 'text-foreground border'
          : 'text-muted-foreground hover:text-foreground bg-[var(--bg-card-2)] border border-transparent'
      }`}
      style={
        active && color
          ? {
              background: `color-mix(in oklch, ${color} 14%, transparent)`,
              color,
              borderColor: `color-mix(in oklch, ${color} 30%, transparent)`,
            }
          : active
            ? { background: 'var(--accent-dim)', borderColor: 'color-mix(in oklch, var(--accent) 30%, transparent)' }
            : undefined
      }
    >
      {children}
      <span className="mono text-[10px] opacity-70">{count}</span>
    </Link>
  );
}

function ListView({ clients, onSelect }: { clients: Conversation[]; onSelect: (c: Conversation) => void }) {
  return (
    <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] overflow-hidden shadow-[var(--shadow-soft)]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Cliente</th>
            <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Proyecto</th>
            <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Etapa</th>
            <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Demo</th>
            <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Avance</th>
            <th className="text-right px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Actividad</th>
          </tr>
        </thead>
        <tbody>
          {clients.map(c => {
            const stage = STAGES.find(s => s.key === c.client_stage);
            const nombre = clientDisplayName({
              nickname: c.nickname,
              reportName: c.report?.cliente?.nombre,
              phone: c.phone,
            });
            const steps = processSteps(c);
            const done = steps.filter(s => s.done).length;
            const pct = Math.round((done / steps.length) * 100);
            return (
              <tr
                key={c.phone}
                onClick={() => onSelect(c)}
                className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-inset)] cursor-pointer transition-colors"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: stage?.dot || 'var(--bg-card-2)' }}
                    >
                      {nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-foreground truncate">{nombre}</div>
                      <div className="mono text-[10px] text-muted-foreground truncate">{c.phone}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-[12px] text-muted-foreground truncate max-w-[220px]">
                  {c.report?.proyecto?.tipo || '—'}
                </td>
                <td className="px-4 py-2.5">
                  {stage && (
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-semibold rounded px-2 py-1"
                      style={{
                        background: `color-mix(in oklch, ${stage.dot} 14%, transparent)`,
                        color: stage.dot,
                      }}
                    >
                      <span className="w-1 h-1 rounded-full" style={{ background: stage.dot }} />
                      {stage.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[11px]">
                  {c.demo_status === 'pending_review' && <span className="text-[var(--amber)] font-semibold">Pendiente revisar</span>}
                  {c.demo_status === 'sent' && <span className="text-[var(--accent-strong)]">✈ Enviado</span>}
                  {c.demo_status === 'approved' && <span className="text-[var(--green)]">✓ Aprobada</span>}
                  {c.demo_status === 'rejected' && <span className="text-[var(--red)]">✗ Rechazada</span>}
                  {(!c.demo_status || c.demo_status === 'none') && <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 max-w-[140px]">
                    <div className="flex-1 h-1 rounded-sm bg-[var(--bg-inset)] overflow-hidden">
                      <div
                        className="h-full rounded-sm bg-[var(--accent)]"
                        style={{ width: `${pct}%`, transition: 'width 1s ease' }}
                      />
                    </div>
                    <span className="mono text-[10px] text-muted-foreground w-8 text-right">{done}/{steps.length}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right mono text-[11px] text-muted-foreground whitespace-nowrap">
                  {timeAgo(c.updated_at)}
                </td>
              </tr>
            );
          })}
          {clients.length === 0 && (
            <tr><td colSpan={6} className="text-center py-12 text-[12px] text-muted-foreground">Sin contactos para mostrar.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LeadDrawer({ client, onClose }: { client: Conversation | null; onClose: () => void }) {
  const router = useRouter();
  if (!client) return null;
  const nombre = client.report?.cliente?.nombre || client.phone;
  const initial = nombre.charAt(0).toUpperCase();
  const stage = STAGES.find(s => s.key === client.client_stage);
  const steps = processSteps(client);
  const doneSteps = steps.filter(s => s.done).length;

  const waUrl = `https://wa.me/${client.phone.replace(/\D/g, '')}`;

  async function advance() {
    if (!client) return;
    const idx = STAGES.findIndex(s => s.key === client.client_stage);
    if (idx === -1 || idx >= STAGES.length - 2) return;
    const next = STAGES[idx + 1];
    try {
      const r = await fetch('/api/admin/client-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: client.phone, newStage: next.key }),
      });
      const d = await r.json();
      if (d.ok) {
        showToast(`Movido a ${next.label}`, 'ok');
        router.refresh();
        onClose();
      } else showToast('Error', 'err');
    } catch {
      showToast('Error de red', 'err');
    }
  }

  async function archive() {
    const ok = await confirmDialog({
      title: client?.archived ? '¿Desarchivar contacto?' : '¿Archivar contacto?',
      description: client?.archived
        ? 'Volverá a aparecer en la vista activa del pipeline.'
        : 'Se ocultará del pipeline. Podés verlo desde "Ver archivados".',
      confirmLabel: client?.archived ? 'Desarchivar' : 'Archivar',
      variant: client?.archived ? 'default' : 'warning',
    });
    if (!ok) return;
    try {
      const r = await fetch(`/api/admin/clients/${encodeURIComponent(client!.phone)}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: client?.archived ? 'unarchive' : 'archive' }),
      });
      const d = await r.json();
      if (d.ok) {
        showToast(client?.archived ? 'Desarchivado' : 'Archivado', 'ok');
        router.refresh();
        onClose();
      } else showToast('Error', 'err');
    } catch { showToast('Error de red', 'err'); }
  }

  return (
    <Drawer
      open={!!client}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full grid place-items-center text-[13px] font-bold text-white flex-shrink-0"
            style={{ background: stage?.dot || 'var(--bg-card-2)' }}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-foreground truncate">{nombre}</div>
            <div className="mono text-[11px] text-muted-foreground">{client.phone}</div>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-[oklch(0.62_0.16_160_/_0.13)] text-[var(--green)] text-[12px] font-medium hover:bg-[oklch(0.62_0.16_160_/_0.20)] transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
          <Link
            href={`/admin/projects/nuevo?phone=${encodeURIComponent(client.phone)}`}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--bg-card-2)] text-foreground text-[12px] font-medium hover:bg-[var(--bg-elevated)] transition-colors border border-[var(--border)]"
          >
            <FolderPlus className="w-3.5 h-3.5" /> Crear proyecto
          </Link>
          <button
            type="button"
            onClick={archive}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md text-[12px] font-medium text-muted-foreground hover:text-[var(--amber)] hover:bg-[oklch(0.74_0.16_75_/_0.10)] transition-colors"
          >
            <Archive className="w-3.5 h-3.5" /> {client.archived ? 'Desarchivar' : 'Archivar'}
          </button>
          <button
            type="button"
            onClick={advance}
            className="ml-auto flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
            style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
          >
            Avanzar etapa <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-5">
        {stage && (
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-semibold"
              style={{ background: `color-mix(in oklch, ${stage.dot} 13%, transparent)`, color: stage.dot }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: stage.dot }} />
              {stage.label}
            </span>
            <Link
              href={`/admin/client/${encodeURIComponent(client.phone)}`}
              className="inline-flex items-center gap-1 text-[11px] text-[var(--accent-strong)] hover:underline ml-auto"
            >
              <Eye className="w-3 h-3" /> Ver ficha completa
            </Link>
          </div>
        )}

        {/* Progreso del proceso */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Avance del proceso</span>
            <span className="mono text-[11px] text-muted-foreground">{doneSteps} de {steps.length}</span>
          </div>
          <div className="h-1.5 rounded-sm bg-[var(--bg-inset)] overflow-hidden mb-3">
            <div
              className="h-full rounded-sm bg-[var(--accent)]"
              style={{ width: `${(doneSteps / steps.length) * 100}%`, transition: 'width 1s ease' }}
            />
          </div>
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-[11px]">
                <span
                  className={`grid place-items-center w-4 h-4 rounded-full flex-shrink-0 ${
                    s.done ? 'bg-[var(--accent)]' : s.warn ? 'bg-[var(--amber)]' : 'bg-[var(--bg-inset)] border border-[var(--border-strong)]'
                  }`}
                >
                  {s.done && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className={s.done ? 'text-foreground' : s.warn ? 'text-[var(--amber)]' : 'text-muted-foreground'}>
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <DataGrid
          items={[
            { label: 'Teléfono',    value: client.phone, mono: true },
            { label: 'Email',       value: client.report?.cliente?.email || '—' },
            { label: 'Ubicación',   value: client.report?.cliente?.ubicacion || '—' },
            { label: 'Rubro',       value: client.report?.cliente?.rubro || '—' },
          ]}
        />

        {client.report?.proyecto && (
          <Section title="Proyecto">
            <DataGrid
              items={[
                { label: 'Tipo',        value: client.report.proyecto.tipo || '—' },
                { label: 'Plataforma',  value: client.report.proyecto.plataforma || '—' },
                { label: 'Audiencia',   value: client.report.proyecto.audiencia_objetivo || '—' },
                { label: 'Modelo',      value: client.report.proyecto.modelo_negocio || '—' },
              ]}
            />
            {client.report.proyecto.descripcion && (
              <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">{client.report.proyecto.descripcion}</p>
            )}
          </Section>
        )}

        {client.report?.resumen_ejecutivo && (
          <Section title="Resumen ejecutivo">
            <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-line">{client.report.resumen_ejecutivo}</p>
          </Section>
        )}

        {client.notes && (
          <Section title="Notas">
            <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-line">{client.notes}</p>
          </Section>
        )}
      </div>
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">{title}</h3>
      {children}
    </div>
  );
}

function DataGrid({ items }: { items: Array<{ label: string; value: string; mono?: boolean }> }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
      {items.map((it) => (
        <div key={it.label}>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{it.label}</div>
          <div className={`text-[12px] text-foreground ${it.mono ? 'mono' : ''}`}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}
