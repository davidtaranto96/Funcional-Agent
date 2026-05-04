'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, FolderKanban, ListTodo, Activity, Wallet,
  Calculator, Folder, History, LogOut, ChevronLeft, Search,
  ContactRound, Receipt,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    label: 'General',
    items: [
      { href: '/admin', label: 'Dashboard', Icon: LayoutDashboard },
    ],
  },
  {
    label: 'Clientes',
    items: [
      { href: '/admin/clients',  label: 'Pipeline',          Icon: Users },
      { href: '/admin/control',  label: 'Centro de Control', Icon: Activity },
      { href: '/admin/clientes', label: 'Clientes',          Icon: ContactRound },
    ],
  },
  {
    label: 'Trabajo',
    items: [
      { href: '/admin/projects', label: 'Proyectos', Icon: FolderKanban },
      { href: '/admin/tasks',    label: 'Tareas',    Icon: ListTodo },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { href: '/admin/finanzas',     label: 'Finanzas',     Icon: Wallet },
      { href: '/admin/presupuesto',  label: 'Presupuestos', Icon: Calculator },
      { href: '/admin/facturas',     label: 'Facturas',     Icon: Receipt },
    ],
  },
  {
    label: 'Recursos',
    items: [
      { href: '/admin/documentos', label: 'Documentos',     Icon: Folder },
      { href: '/admin/changelog',  label: 'Actualizaciones', Icon: History },
    ],
  },
];

export function Sidebar({ user }: { user?: { name?: string; email?: string; photo?: string } }) {
  const pathname = usePathname() || '';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === '1') setCollapsed(true);
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', next ? '1' : '0');
  }

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  }

  const initial = (user?.name || 'D').charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        aria-label="Abrir navegación"
        aria-expanded={mobileOpen}
        aria-controls="admin-sidebar"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-card border border-[var(--border-strong)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/65 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        id="admin-sidebar"
        aria-label="Navegación principal"
        className={cn(
          'fixed md:sticky top-0 left-0 z-50 h-[100dvh] flex flex-col',
          'bg-card border-r border-[var(--border)]',
          'transition-[width,transform] duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          collapsed ? 'md:w-[72px]' : 'md:w-[232px]',
          'w-[260px]',
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            'flex items-center border-b border-[var(--border)] flex-shrink-0 py-3',
            collapsed ? 'justify-center px-0' : 'justify-between gap-2 px-3.5',
          )}
        >
          <button
            type="button"
            onClick={toggleCollapse}
            className={cn('flex items-center group min-w-0', collapsed ? 'justify-center' : 'gap-2.5')}
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            <span
              className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-primary text-white text-[10px] font-extrabold flex-shrink-0"
              style={{ boxShadow: '0 4px 12px var(--accent-glow)' }}
            >
              DT
            </span>
            {!collapsed && (
              <span className="min-w-0 text-left">
                <span className="block text-[13px] font-bold text-foreground tracking-tight truncate">DT Systems</span>
                <span className="block mono text-[9.5px] text-muted-foreground truncate mt-0.5">CRM &amp; Proyectos · v5.1.0</span>
              </span>
            )}
          </button>
          {!collapsed && (
            <button
              type="button"
              aria-label="Colapsar sidebar"
              onClick={toggleCollapse}
              className="hidden md:grid place-items-center w-7 h-7 rounded-md hover:bg-[var(--bg-inset)] text-muted-foreground flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search trigger */}
        {!collapsed && (
          <div className="px-3 pt-2.5 pb-1">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('pd-cmdk-open'))}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[rgba(255,255,255,0.04)] border border-[var(--border)] text-left hover:border-[var(--border-strong)] transition-colors"
            >
              <Search className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground flex-1 truncate">Buscar…</span>
              <kbd className="mono text-[9px] text-muted-foreground bg-[rgba(255,255,255,0.03)] border border-[var(--border)] px-1.5 py-px rounded">⌘K</kbd>
            </button>
          </div>
        )}

        {/* Nav */}
        <nav aria-label="Secciones del panel" className={cn('flex-1 overflow-y-auto py-2', collapsed ? 'px-0' : 'px-2.5')}>
          {NAV.map((section) => (
            <div key={section.label} className="mb-3 last:mb-0">
              {!collapsed && (
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground px-2 mb-1">
                  {section.label}
                </div>
              )}
              <ul className="space-y-0.5">
                {section.items.map(({ href, label, Icon }) => {
                  const active = isActive(href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? label : undefined}
                        className={cn(
                          'group relative flex items-center rounded-lg text-[13px] font-medium transition-colors',
                          collapsed ? 'justify-center h-9 w-[30px] mx-auto' : 'gap-2 px-2.5 h-8',
                          active
                            ? 'text-[var(--accent)] bg-[var(--accent-dim)]'
                            : 'text-muted-foreground hover:text-foreground hover:bg-[var(--bg-inset)]',
                        )}
                      >
                        {active && !collapsed && (
                          <span className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r bg-[var(--accent)]" />
                        )}
                        <Icon className="w-[15px] h-[15px] flex-shrink-0" />
                        {!collapsed && <span className="truncate">{label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User + logout */}
        <div className={cn('border-t border-[var(--border)] flex-shrink-0', collapsed ? 'py-2.5 px-0' : 'p-2.5')}>
          <div className={cn('flex items-center rounded-md', collapsed ? 'justify-center py-1.5' : 'gap-2 px-2 py-1.5')}>
            {user?.photo ? (
              <img
                src={user.photo}
                alt=""
                className="w-[26px] h-[26px] rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-[26px] h-[26px] rounded-full bg-primary text-white grid place-items-center text-[10px] font-bold flex-shrink-0"
              >
                {initial}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-foreground truncate leading-tight">{user?.name || 'David Taranto'}</div>
                <div className="text-[10px] text-muted-foreground truncate mt-0.5">Admin · Salta</div>
              </div>
            )}
          </div>
          <form method="POST" action="/api/logout" className="mt-1">
            <button
              type="submit"
              className={cn(
                'flex items-center rounded-md text-xs',
                'text-muted-foreground hover:text-[oklch(70%_0.18_25)] hover:bg-[oklch(0.62_0.22_27_/_0.10)] transition-colors',
                collapsed ? 'justify-center w-[30px] h-9 mx-auto' : 'gap-2 w-full px-2.5 h-8',
              )}
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
              {!collapsed && <span>Cerrar sesión</span>}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
