'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, FolderKanban, ListTodo, Activity, Wallet,
  Calculator, Folder, FileText, History, LogOut, ChevronLeft,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  group?: 'work' | 'crm' | 'finance' | 'config';
}

const NAV: NavItem[] = [
  { href: '/admin',           label: 'Dashboard',     Icon: LayoutDashboard, group: 'work' },
  { href: '/admin/control',   label: 'Centro',        Icon: Activity,        group: 'work' },
  { href: '/admin/clients',   label: 'Pipeline WA',   Icon: Users,           group: 'crm' },
  { href: '/admin/clientes',  label: 'Clientes',      Icon: Users,           group: 'crm' },
  { href: '/admin/projects',  label: 'Proyectos',     Icon: FolderKanban,    group: 'crm' },
  { href: '/admin/tasks',     label: 'Tareas',        Icon: ListTodo,        group: 'crm' },
  { href: '/admin/finanzas',  label: 'Finanzas',      Icon: Wallet,          group: 'finance' },
  { href: '/admin/presupuesto', label: 'Presupuesto', Icon: Calculator,      group: 'finance' },
  { href: '/admin/documentos', label: 'Documentos',   Icon: Folder,          group: 'finance' },
  { href: '/admin/changelog', label: 'Changelog',     Icon: History,         group: 'config' },
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
          'transition-transform md:transition-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          collapsed ? 'md:w-[72px]' : 'md:w-[240px]',
          'w-[260px]',
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--border)] flex-shrink-0">
          <Link href="/admin" className="flex items-center gap-2 text-foreground font-semibold tracking-tight">
            <span className="w-7 h-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-bold">DT</span>
            {!collapsed && <span className="text-sm">DT Systems</span>}
          </Link>
          <button
            type="button"
            aria-label="Colapsar sidebar"
            onClick={toggleCollapse}
            className="hidden md:grid place-items-center w-7 h-7 rounded-md hover:bg-secondary text-muted-foreground"
          >
            <ChevronLeft className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>

        {/* Nav */}
        <nav aria-label="Secciones del panel" className="flex-1 overflow-y-auto py-3 px-2">
          <ul className="space-y-0.5">
            {NAV.map(({ href, label, Icon }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileOpen(false)}
                    data-label={label}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-md px-3 h-9 text-sm transition-colors',
                      active
                        ? 'text-foreground bg-[var(--accent-dim)]'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r bg-primary" />
                    )}
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User + logout */}
        <div className="border-t border-[var(--border)] p-3 flex-shrink-0">
          <div className={cn('flex items-center gap-2 mb-2', collapsed && 'justify-center')}>
            {user?.photo ? (
              <img
                src={user.photo}
                alt=""
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-bold">{initial}</div>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-foreground truncate">{user?.name || 'David'}</div>
                {user?.email && <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>}
              </div>
            )}
          </div>
          <form method="POST" action="/api/logout">
            <button
              type="submit"
              className={cn(
                'w-full flex items-center gap-2 rounded-md px-3 h-8 text-xs',
                'text-[var(--red)] hover:bg-[oklch(0.62_0.22_27_/_0.10)] transition-colors',
                collapsed && 'justify-center',
              )}
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              {!collapsed && <span>Cerrar sesión</span>}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
