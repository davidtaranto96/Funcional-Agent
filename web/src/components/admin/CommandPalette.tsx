'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, LayoutDashboard, Activity, Users, ContactRound, FolderKanban,
  ListTodo, Wallet, Calculator, Receipt, Folder, History, X,
} from 'lucide-react';

type ItemType = 'page' | 'client' | 'project' | 'contact';

interface Item {
  type: ItemType;
  title: string;
  sub?: string;
  href: string;
  Icon?: React.ComponentType<{ className?: string }>;
}

const PAGES: Item[] = [
  { type: 'page', title: 'Dashboard',         sub: 'Vista general',                href: '/admin',              Icon: LayoutDashboard },
  { type: 'page', title: 'Pipeline',          sub: 'Embudo de leads WhatsApp',     href: '/admin/clients',      Icon: Users },
  { type: 'page', title: 'Centro de Control', sub: 'Operaciones del agente',       href: '/admin/control',      Icon: Activity },
  { type: 'page', title: 'Clientes',          sub: 'Base de clientes',             href: '/admin/clientes',     Icon: ContactRound },
  { type: 'page', title: 'Proyectos',         sub: 'Todos los proyectos',          href: '/admin/projects',     Icon: FolderKanban },
  { type: 'page', title: 'Tareas',            sub: 'Vista global de tareas',       href: '/admin/tasks',        Icon: ListTodo },
  { type: 'page', title: 'Finanzas',          sub: 'Dashboard financiero',         href: '/admin/finanzas',     Icon: Wallet },
  { type: 'page', title: 'Presupuestos',      sub: 'Crear y gestionar',            href: '/admin/presupuesto',  Icon: Calculator },
  { type: 'page', title: 'Facturas',          sub: 'Emisión y cobro',              href: '/admin/facturas',     Icon: Receipt },
  { type: 'page', title: 'Documentos',        sub: 'Mi Drive',                     href: '/admin/documentos',   Icon: Folder },
  { type: 'page', title: 'Actualizaciones',   sub: 'Changelog del sistema',        href: '/admin/changelog',    Icon: History },
];

const TYPE_COLOR: Record<ItemType, string> = {
  page:    'oklch(0.62 0.20 250)',
  client:  'oklch(0.62 0.16 160)',
  project: 'oklch(0.62 0.18 290)',
  contact: 'oklch(0.74 0.16 75)',
};

const TYPE_LABEL: Record<ItemType, string> = {
  page: 'Página', client: 'Cliente', project: 'Proyecto', contact: 'Contacto',
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [data, setData] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Open with Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      // Click on sidebar search button dispatches an event
    }
    function onCustomOpen() { setOpen(true); }
    window.addEventListener('keydown', onKey);
    window.addEventListener('pd-cmdk-open', onCustomOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pd-cmdk-open', onCustomOpen);
    };
  }, []);

  // Lazy-load index when first opened
  useEffect(() => {
    if (!open || loaded) return;
    fetch('/api/admin/search')
      .then(r => r.json())
      .then(d => {
        if (d.ok) setData(d.items as Item[]);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [open, loaded]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const all = useMemo(() => [...PAGES, ...data], [data]);

  const filtered = useMemo(() => {
    if (!q.trim()) return all.slice(0, 12);
    const lq = q.toLowerCase();
    return all
      .filter(i => i.title.toLowerCase().includes(lq) || i.sub?.toLowerCase().includes(lq))
      .slice(0, 14);
  }, [q, all]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSel(s => Math.min(s + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSel(s => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[sel];
        if (item) {
          router.push(item.href);
          setOpen(false);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, sel, router]);

  // Reset selection when filter changes
  useEffect(() => { setSel(0); }, [q]);

  // Scroll selected into view
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-start justify-center pt-[min(15vh,120px)] px-4 pd-fade-in"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[560px] bg-card border border-[var(--border-strong)] rounded-[var(--r-xl)] shadow-[var(--shadow-elev)] overflow-hidden pd-modal-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar páginas, clientes, proyectos…"
            className="w-full pl-12 pr-12 py-4 bg-transparent border-none outline-none text-[15px] text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-[var(--bg-inset)]"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto border-t border-[var(--border)]">
          {filtered.length === 0 ? (
            <div className="p-7 text-center text-[13px] text-muted-foreground">
              {q ? `Sin resultados para "${q}"` : 'Empezá a escribir para buscar…'}
            </div>
          ) : (
            filtered.map((item, i) => {
              const Icon = item.Icon;
              const color = TYPE_COLOR[item.type];
              return (
                <button
                  key={`${item.type}-${item.href}-${i}`}
                  data-idx={i}
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => { router.push(item.href); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                    sel === i ? 'bg-[var(--bg-inset)]' : ''
                  }`}
                >
                  <span
                    className="grid place-items-center w-7 h-7 rounded-md flex-shrink-0"
                    style={{ background: `color-mix(in oklch, ${color} 14%, transparent)`, color }}
                  >
                    {Icon ? <Icon className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">{item.title.charAt(0).toUpperCase()}</span>}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium text-foreground truncate">{item.title}</span>
                    {item.sub && (
                      <span className="block text-[11px] text-muted-foreground truncate mt-0.5">{item.sub}</span>
                    )}
                  </span>
                  <span
                    className="mono text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: `color-mix(in oklch, ${color} 14%, transparent)`, color }}
                  >
                    {TYPE_LABEL[item.type]}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3.5 px-5 py-2.5 border-t border-[var(--border)] text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><kbd className="pd-kbd">↑</kbd><kbd className="pd-kbd">↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="pd-kbd">↵</kbd> abrir</span>
          <span className="flex items-center gap-1"><kbd className="pd-kbd">esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}
