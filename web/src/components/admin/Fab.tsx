'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Plus, Users, FolderKanban, ListTodo, ContactRound, Folder, Calculator, X, Search,
} from 'lucide-react';

interface Action {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  onClick?: () => void;
  color: string;
}

export function Fab() {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // No mostrar en login
  if (pathname.startsWith('/login')) return null;

  const actions: Action[] = [
    { Icon: Search,        label: 'Buscar (⌘K)',           color: 'oklch(0.62 0.18 250)', onClick: () => window.dispatchEvent(new Event('pd-cmdk-open')) },
    { Icon: ContactRound,  label: 'Nuevo cliente',          color: 'oklch(0.62 0.20 250)', href: '/admin/clientes/nuevo' },
    { Icon: FolderKanban,  label: 'Nuevo proyecto',         color: 'oklch(0.62 0.18 290)', href: '/admin/projects/nuevo' },
    { Icon: Calculator,    label: 'Nuevo presupuesto',      color: 'oklch(0.62 0.16 160)', href: '/admin/presupuesto' },
    { Icon: Folder,        label: 'Nueva carpeta',          color: 'oklch(0.74 0.16 75)',  href: '/admin/documentos' },
    { Icon: Users,         label: 'Ver pipeline WA',        color: 'oklch(0.62 0.16 200)', href: '/admin/clients' },
    { Icon: ListTodo,      label: 'Ver tareas',             color: 'oklch(0.62 0.20 250)', href: '/admin/tasks' },
  ];

  function handleAction(a: Action) {
    setOpen(false);
    if (a.onClick) a.onClick();
    else if (a.href) router.push(a.href);
  }

  return (
    <div ref={ref} className="fixed bottom-5 right-5 z-[300] flex flex-col items-end gap-2">
      {/* Acciones */}
      {open && (
        <div className="flex flex-col items-end gap-1.5 pd-fade-in">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => handleAction(a)}
              className="group flex items-center gap-2 bg-card border border-[var(--border-strong)] rounded-full pl-3 pr-1.5 py-1.5 shadow-[var(--shadow-elev)] hover:bg-[var(--bg-inset)] transition-colors"
            >
              <span className="text-[12px] font-medium text-foreground whitespace-nowrap pr-1">{a.label}</span>
              <span
                className="grid place-items-center w-7 h-7 rounded-full text-white"
                style={{ background: a.color, boxShadow: `0 2px 8px color-mix(in oklch, ${a.color} 35%, transparent)` }}
              >
                <a.Icon className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Cerrar menú rápido' : 'Acciones rápidas'}
        className="grid place-items-center w-12 h-12 rounded-full bg-primary text-white transition-all hover:brightness-110"
        style={{ boxShadow: '0 8px 24px var(--accent-glow), 0 4px 12px color-mix(in oklch, var(--accent) 30%, transparent)' }}
      >
        {open ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
      </button>
    </div>
  );
}

// Helper para que algunos screens muestren un mini FAB inline (no se usa por defecto pero queda exportado)
export function FabSpacer() {
  return <div className="h-16" aria-hidden />;
}
