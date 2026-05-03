import { APP_VERSION } from '@/lib/constants';
import { History, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  tag?: 'new' | 'improvement' | 'fix';
  changes: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '5.0.0-alpha.1',
    date: '2026-05-03',
    title: 'Migración a Next.js 15 — foundation',
    tag: 'new',
    changes: [
      'Stack nuevo: Next.js 15 (App Router) + React 19 + TS strict + Tailwind v4 + iron-session',
      'Tokens "Precision Dark" portados (paleta OKLCH, fuente Geist sans+mono, radii consistentes)',
      'Components hand-rolled estilo shadcn (Button, Card, Input, Badge, Label, Sidebar, KPICard, Toast)',
      'Auth con iron-session: ADMIN_SESSION_SECRET fail-closed en producción, cookie httpOnly+secure+sameSite',
      'Pages: /login, /admin (dashboard), /admin/clients (kanban WA), /admin/client/[phone], /admin/clientes (CRM), /admin/review/[phone]',
      'Pages: /admin/projects, /admin/projects/[id], /admin/tasks, /admin/control, /admin/notifications, /admin/finanzas, /admin/changelog, /admin/documentos',
      'API: /api/webhook (Twilio sig verify), /api/login, /api/logout, /api/health, /api/admin/* (auth)',
      'Lib portado a TS: db, agent, whatsapp, transcriber, calendar, drive, mailer, demos, reports, orchestrator, twilio-verify',
    ],
  },
  {
    version: '4.0.0',
    date: '2026-05-02',
    title: 'Rediseño Visual Completo — Precision Dark',
    tag: 'improvement',
    changes: [
      'Sistema de diseño "Precision Dark": paleta OKLCH (azul accent + verde/ámbar/rojo/púrpura semánticos)',
      'Tipografía: fuente Geist (sans + mono) en todo el panel',
      'Sidebar agrupado por sección con barra lateral 3px accent',
      'Pipeline kanban con drawer overlay y colores por etapa',
      'Dashboard con KPI cards animadas + funnel + deadlines + actividad reciente',
      'Centro de Control reposicionado con banner de salud + bandeja de acción',
      '⌘K Command Palette global con búsqueda fuzzy',
      'Documentos: Mi Drive con layout de 2 paneles',
    ],
  },
  {
    version: '3.2.0',
    date: '2026-04-22',
    title: 'Sidebar Rediseñado + Presupuestos Mejorados',
    changes: [
      'Sidebar: íconos SVG minimalistas reemplazan emojis',
      'Presupuestos: nuevo endpoint POST /api/save-quote guarda en documentos del proyecto',
      'Finanzas: calculadora reemplazada por banner con link al módulo de Presupuestos',
    ],
  },
  {
    version: '3.0.0',
    date: '2026-04-12',
    title: 'Dark Mode + Command Palette + Sidebar Colapsable',
    changes: [
      'Modo oscuro/claro con toggle y persistencia en localStorage',
      'Command Palette (⌘K / Ctrl+K) — buscar clientes, proyectos, tareas',
      'Sidebar colapsable en desktop, FAB con acciones rápidas',
      'Widget financiero en Dashboard',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-04-11',
    title: 'Kanban Views + Centro de Control Upgrade',
    changes: [
      'Vistas Kanban con drag-and-drop para Tareas (3 cols)',
      'Kanban para Proyectos (cols por status)',
      'Pipeline CRM con drag-and-drop entre stages',
      'SortableJS integrado, sistema de toast',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-04-01',
    title: 'Lanzamiento inicial — CRM WhatsApp',
    changes: [
      'Pipeline de clientes WhatsApp con agente conversacional',
      'Generación automática de demos (Landing, WhatsApp mockup, PDF)',
      'Sistema de revisión y aprobación de demos',
      'Centro de Control con acciones pendientes',
      'Transcripción de audios con Groq Whisper',
    ],
  },
];

const TAG_STYLES: Record<NonNullable<ChangelogEntry['tag']>, { label: string; color: string }> = {
  new:         { label: 'Nuevo',   color: 'oklch(0.62 0.16 160)' },
  improvement: { label: 'Mejora',  color: 'oklch(0.62 0.20 250)' },
  fix:         { label: 'Fix',     color: 'oklch(0.74 0.16 75)' },
};

export default function ChangelogPage() {
  return (
    <div className="max-w-[760px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-7">
        <div
          className="grid place-items-center w-10 h-10 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] flex-shrink-0"
          style={{ boxShadow: '0 4px 14px var(--accent-glow)' }}
        >
          <History className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Actualizaciones</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Versiones e historia del producto · {CHANGELOG.length} releases
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {CHANGELOG.map(entry => {
          const isCurrent = entry.version === APP_VERSION;
          const tag = entry.tag ? TAG_STYLES[entry.tag] : null;
          return (
            <article key={entry.version} className="relative">
              {/* Línea vertical */}
              <span
                className="absolute left-[18px] top-12 bottom-0 w-px bg-[var(--border)]"
                aria-hidden
              />

              {/* Header */}
              <header className="flex items-baseline gap-3 mb-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <span
                    className={`relative grid place-items-center w-9 h-9 rounded-lg flex-shrink-0 ${
                      isCurrent ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-card-2)] text-muted-foreground'
                    }`}
                    style={isCurrent ? { boxShadow: '0 4px 14px var(--accent-glow)' } : undefined}
                  >
                    {isCurrent ? <Sparkles className="w-4 h-4" /> : <History className="w-3.5 h-3.5" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="mono text-[16px] font-bold text-[var(--accent-strong)]">v{entry.version}</span>
                      {isCurrent && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--accent)] bg-[var(--accent-dim)] rounded px-1.5 py-0.5">
                          Actual
                        </span>
                      )}
                      {tag && (
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5"
                          style={{
                            background: `color-mix(in oklch, ${tag.color} 14%, transparent)`,
                            color: tag.color,
                          }}
                        >
                          {tag.label}
                        </span>
                      )}
                    </div>
                    <div className="mono text-[10px] text-muted-foreground mt-0.5">{entry.date}</div>
                  </div>
                </div>
              </header>

              {/* Card */}
              <div className="ml-12 bg-card border border-[var(--border)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow-soft)]">
                <h2 className="text-[14px] font-semibold text-foreground mb-3 leading-snug">{entry.title}</h2>
                <ul className="space-y-2">
                  {entry.changes.map((c, j) => (
                    <li key={j} className="text-[12px] text-muted-foreground flex items-start gap-2.5 leading-relaxed">
                      <span
                        className="grid place-items-center w-4 h-4 rounded-full bg-[oklch(0.62_0.16_160_/_0.13)] text-[var(--green)] flex-shrink-0 mt-0.5"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
