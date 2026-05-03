'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { PROJECT_STATUS } from '@/lib/constants';
import { formatARS, timeAgo } from '@/lib/utils';
import type { Project } from '@/lib/db';

export function ProjectsList({ projects }: { projects: Project[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (p.title || '').toLowerCase().includes(q) ||
        (p.client_name || '').toLowerCase().includes(q) ||
        (p.type || '').toLowerCase().includes(q)
      );
    });
  }, [projects, search, statusFilter]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cliente, tipo…"
            className="w-full h-9 pl-9 pr-3 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)] transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 px-2.5 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-[12px] text-foreground outline-none focus:border-[var(--accent)] cursor-pointer"
        >
          <option value="all">Todos los estados</option>
          {PROJECT_STATUS.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <span className="mono text-[10px] text-muted-foreground ml-auto">{filtered.length} de {projects.length}</span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] overflow-hidden shadow-[var(--shadow-soft)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Proyecto</th>
              <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hidden sm:table-cell">Cliente</th>
              <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Estado</th>
              <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hidden md:table-cell">Progreso</th>
              <th className="text-right px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hidden lg:table-cell">Presupuesto</th>
              <th className="text-right px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const tasks = p.tasks || [];
              const total = tasks.length;
              const done = tasks.filter(t => t.done).length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const status = PROJECT_STATUS.find(s => s.key === p.status);
              const budgetNum = Number(String(p.budget || '').replace(/[^\d.-]/g, ''));
              return (
                <tr key={p.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-inset)] transition-colors group">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/projects/${p.id}`} className="block">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: status?.color || 'var(--text-3)', boxShadow: `0 0 6px ${status?.color}` }}
                        />
                        <div className="min-w-0">
                          <div className="text-[12px] font-medium text-foreground truncate group-hover:text-[var(--accent-strong)] transition-colors">
                            {p.title || 'Sin título'}
                          </div>
                          {p.type && <div className="text-[10px] text-muted-foreground truncate">{p.type}</div>}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell text-[11px] text-muted-foreground">
                    {p.client_name || (p.is_personal ? <span className="italic">Personal</span> : '—')}
                  </td>
                  <td className="px-4 py-2.5">
                    {status && (
                      <span
                        className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider rounded px-2 py-1"
                        style={{
                          background: `color-mix(in oklch, ${status.color} 14%, transparent)`,
                          color: status.color,
                        }}
                      >
                        {status.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    {total > 0 ? (
                      <div className="flex items-center gap-2 max-w-[140px]">
                        <div className="flex-1 h-1 rounded-sm bg-[var(--bg-inset)] overflow-hidden">
                          <div
                            className="h-full rounded-sm bg-[var(--accent)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="mono text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-right mono text-[11px] text-muted-foreground">
                    {Number.isFinite(budgetNum) && budgetNum > 0 ? formatARS(budgetNum) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {timeAgo(p.updated_at)}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[12px] text-muted-foreground">
                  Sin proyectos para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
