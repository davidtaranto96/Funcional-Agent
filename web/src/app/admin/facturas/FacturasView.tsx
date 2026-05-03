'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Receipt, Eye, Check, X } from 'lucide-react';
import type { Invoice } from '@/lib/db';
import { formatARS } from '@/lib/utils';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Borrador',  color: 'oklch(0.5 0.05 250)'  },
  sent:      { label: 'Enviada',   color: 'oklch(0.74 0.16 75)'  },
  paid:      { label: 'Pagada',    color: 'oklch(0.62 0.16 160)' },
  overdue:   { label: 'Vencida',   color: 'oklch(0.62 0.22 27)'  },
  cancelled: { label: 'Anulada',   color: 'oklch(0.5 0.05 250)'  },
};

const FILTERS = ['todas', 'draft', 'sent', 'paid', 'overdue', 'cancelled'] as const;

interface ProjectLite { id: string; title: string; client_name: string }

export function FacturasView({ invoices, projects }: { invoices: Invoice[]; projects: ProjectLite[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('todas');

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (filter !== 'todas' && inv.status !== filter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        inv.number.toLowerCase().includes(q) ||
        inv.client_name.toLowerCase().includes(q) ||
        inv.notes.toLowerCase().includes(q)
      );
    });
  }, [invoices, search, filter]);

  const projectMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número, cliente, notas…"
            className="w-full h-9 pl-9 pr-3 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)] transition-colors"
          />
        </div>
        <div className="flex items-center bg-[var(--bg-card-2)] border border-[var(--border)] rounded-md p-0.5 flex-wrap">
          {FILTERS.map(f => {
            const active = filter === f;
            const count = f === 'todas' ? invoices.length : invoices.filter(i => i.status === f).length;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded text-[11px] font-medium capitalize transition-colors ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {f === 'todas' ? 'Todas' : STATUS_LABELS[f]?.label || f}
                <span className="mono text-[10px] opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        <span className="mono text-[10px] text-muted-foreground ml-auto">
          {filtered.length} de {invoices.length}
        </span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] overflow-hidden shadow-[var(--shadow-soft)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Número</th>
              <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Cliente / Proyecto</th>
              <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Emisión</th>
              <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Vence</th>
              <th className="text-right px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Monto</th>
              <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Estado</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => {
              const status = STATUS_LABELS[inv.status] || STATUS_LABELS.draft;
              const project = inv.project_id ? projectMap[inv.project_id] : null;
              return (
                <tr key={inv.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-inset)] transition-colors group">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/facturas/${inv.id}`} className="flex items-center gap-2 group/link">
                      <div
                        className="grid place-items-center w-7 h-7 rounded-md flex-shrink-0"
                        style={{ background: `color-mix(in oklch, ${status.color} 14%, transparent)` }}
                      >
                        <Receipt className="w-3.5 h-3.5" style={{ color: status.color }} />
                      </div>
                      <span className="mono text-[12px] font-semibold text-foreground group-hover/link:text-[var(--accent-strong)] transition-colors">
                        {inv.number || '—'}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-[12px] text-foreground truncate max-w-[280px]">
                      {inv.client_name || <span className="text-muted-foreground italic">sin cliente</span>}
                    </div>
                    {project && (
                      <div className="text-[10px] text-muted-foreground truncate max-w-[280px]">
                        {project.title}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 mono text-[11px] text-muted-foreground">
                    {inv.issue_date || '—'}
                  </td>
                  <td className="px-4 py-2.5 mono text-[11px] text-muted-foreground">
                    {inv.due_date || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="mono text-[12px] font-bold text-foreground">
                      {inv.currency === 'USD' ? `US$ ${inv.amount.toFixed(2)}` : formatARS(inv.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider rounded px-2 py-1"
                      style={{
                        background: `color-mix(in oklch, ${status.color} 14%, transparent)`,
                        color: status.color,
                      }}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/facturas/${inv.id}`}
                      className="grid place-items-center w-7 h-7 rounded text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                      aria-label="Ver"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-[12px] text-muted-foreground">
                  Sin resultados con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 flex-wrap text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Check className="w-3 h-3 text-[var(--green)]" /> Cobrada al marcar como pagada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <X className="w-3 h-3 text-[var(--red)]" /> Vencida cuando supera fecha de pago
        </span>
      </div>
    </>
  );
}
