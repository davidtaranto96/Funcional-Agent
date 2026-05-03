'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Mail, Phone, Building2, FolderKanban, Trash2, Tag, X, CheckSquare, Square } from 'lucide-react';
import type { ClientRecord } from '@/lib/db';
import { confirmDialog } from '@/components/admin/ConfirmModal';
import { showToast } from '@/components/ui/toast';

type ClientWithCount = ClientRecord & { _projects?: number };

const CATEGORY_COLORS: Record<string, string> = {
  cliente:     'oklch(0.62 0.20 250)',
  lead:        'oklch(0.74 0.16 75)',
  proveedor:   'oklch(0.62 0.18 290)',
  colaborador: 'oklch(0.62 0.16 160)',
  otro:        'oklch(0.5 0.05 250)',
};

const CATEGORIES = ['todos', 'cliente', 'lead', 'proveedor', 'colaborador', 'otro'] as const;
const BULK_TARGETS = ['cliente', 'lead', 'proveedor', 'colaborador', 'otro'] as const;

export function ClientesView({ clientes }: { clientes: ClientWithCount[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('todos');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);

  const filtered = useMemo(() => {
    return clientes.filter(c => {
      if (category !== 'todos' && c.category !== category) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q)
      );
    });
  }, [clientes, search, category]);

  const allSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) {
      const rest = new Set(selected);
      filtered.forEach(c => rest.delete(c.id));
      setSelected(rest);
    } else {
      const next = new Set(selected);
      filtered.forEach(c => next.add(c.id));
      setSelected(next);
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  async function bulkChangeCategory(target: string) {
    if (selected.size === 0) return;
    setWorking(true);
    let ok = 0;
    for (const id of Array.from(selected)) {
      const c = clientes.find(x => x.id === id);
      if (!c) continue;
      try {
        const fd = new FormData();
        fd.set('name', c.name || '');
        fd.set('phone', c.phone || '');
        fd.set('email', c.email || '');
        fd.set('company', c.company || '');
        fd.set('category', target);
        fd.set('notes', c.notes || '');
        const r = await fetch(`/api/admin/clientes/${id}/update`, { method: 'POST', body: fd });
        if (r.ok || r.status === 303) ok++;
      } catch { /* skip */ }
    }
    setWorking(false);
    setSelected(new Set());
    showToast(`${ok} de ${selected.size} actualizados a "${target}"`, ok === selected.size ? 'ok' : 'err');
    router.refresh();
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    const ok = await confirmDialog({
      title: `¿Borrar ${selected.size} cliente${selected.size === 1 ? '' : 's'}?`,
      description: 'Esta acción no se puede deshacer. Los proyectos asociados quedan huérfanos pero no se borran.',
      confirmLabel: 'Sí, borrar',
      variant: 'danger',
    });
    if (!ok) return;
    setWorking(true);
    let success = 0;
    for (const id of Array.from(selected)) {
      try {
        const r = await fetch(`/api/admin/clientes/${id}/delete`, { method: 'POST' });
        if (r.ok || r.status === 303) success++;
      } catch { /* skip */ }
    }
    setWorking(false);
    setSelected(new Set());
    showToast(`${success} de ${selected.size} borrados`, success === selected.size ? 'ok' : 'err');
    router.refresh();
  }

  return (
    <>
      {/* Toolbar (sticky) */}
      <div className="sticky top-0 z-20 bg-[var(--bg)] py-2 -my-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email, empresa…"
              className="w-full h-9 pl-9 pr-3 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)] transition-colors"
            />
          </div>
          <div className="flex items-center bg-[var(--bg-card-2)] border border-[var(--border)] rounded-md p-0.5 flex-wrap">
            {CATEGORIES.map(cat => {
              const active = category === cat;
              const count = cat === 'todos' ? clientes.length : clientes.filter(c => c.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded text-[11px] font-medium capitalize transition-colors ${
                    active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cat}
                  <span className="mono text-[10px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
          <span className="mono text-[10px] text-muted-foreground ml-auto">
            {filtered.length} de {clientes.length}
          </span>
        </div>

        {/* Batch actions bar */}
        {selected.size > 0 && (
          <div className="mt-2 flex items-center gap-2 bg-[var(--accent-dim)] border border-[var(--accent)] rounded-md px-3 py-1.5 pd-fade-in flex-wrap">
            <span className="mono text-[11px] font-semibold text-[var(--accent-strong)]">
              {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-1">
              <Tag className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">Cambiar a:</span>
              {BULK_TARGETS.map(t => (
                <button
                  key={t}
                  type="button"
                  disabled={working}
                  onClick={() => bulkChangeCategory(t)}
                  className="h-6 px-2 rounded text-[10px] font-medium capitalize hover:bg-card transition-colors disabled:opacity-40"
                  style={{ color: CATEGORY_COLORS[t] }}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={working}
              onClick={bulkDelete}
              className="ml-auto flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium text-[var(--red)] hover:bg-[oklch(0.62_0.22_27_/_0.10)] transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3 h-3" /> Borrar
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="grid place-items-center w-5 h-5 rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Deseleccionar"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] overflow-hidden shadow-[var(--shadow-soft)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="w-10 px-3 py-2.5">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="grid place-items-center w-5 h-5 rounded text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                >
                  {allSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-[var(--accent)]" />
                  ) : someSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-[var(--accent)] opacity-50" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </button>
              </th>
              <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Cliente</th>
              <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Empresa</th>
              <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Contacto</th>
              <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Proyectos</th>
              <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const initial = (c.name || '?').charAt(0).toUpperCase();
              const catColor = CATEGORY_COLORS[c.category] || 'oklch(0.5 0.05 250)';
              const isSel = selected.has(c.id);
              return (
                <tr
                  key={c.id}
                  className={`border-b border-[var(--border)] last:border-0 transition-colors group ${
                    isSel ? 'bg-[var(--accent-dim)]' : 'hover:bg-[var(--bg-inset)]'
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleOne(c.id)}
                      className="grid place-items-center w-5 h-5 rounded text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={isSel ? 'Deseleccionar' : 'Seleccionar'}
                    >
                      {isSel ? (
                        <CheckSquare className="w-3.5 h-3.5 text-[var(--accent)]" />
                      ) : (
                        <Square className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/clientes/${c.id}`} className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-bold text-white flex-shrink-0"
                        style={{ background: catColor }}
                      >
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-foreground truncate group-hover:text-[var(--accent-strong)] transition-colors">
                          {c.name || 'Sin nombre'}
                        </div>
                        {c.notes && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[280px]">
                            {c.notes}
                          </div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-muted-foreground">
                    {c.company ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 flex-shrink-0" />
                        {c.company}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="space-y-0.5">
                      {c.phone && (
                        <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="mono text-[11px] text-muted-foreground hover:text-[var(--green)] inline-flex items-center gap-1.5 transition-colors">
                          <Phone className="w-3 h-3" /> {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-[11px] text-muted-foreground hover:text-[var(--accent-strong)] inline-flex items-center gap-1.5 transition-colors block">
                          <Mail className="w-3 h-3" /> {c.email}
                        </a>
                      )}
                      {!c.phone && !c.email && <span className="text-[11px] text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {(c._projects || 0) > 0 ? (
                      <Link
                        href={`/admin/projects?client=${c.id}`}
                        className="inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)] hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        <FolderKanban className="w-3 h-3" />
                        {c._projects} proyecto{c._projects === 1 ? '' : 's'}
                      </Link>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider rounded px-2 py-1 capitalize"
                      style={{
                        background: `color-mix(in oklch, ${catColor} 14%, transparent)`,
                        color: catColor,
                      }}
                    >
                      {c.category}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[12px] text-muted-foreground">
                  Sin resultados con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
