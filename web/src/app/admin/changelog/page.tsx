import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { APP_VERSION } from '@/lib/constants';

export const dynamic = 'force-dynamic';

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '5.0.0-alpha.1',
    date: '2026-05-03',
    title: 'Migración a Next.js 15 — foundation',
    changes: [
      'Stack nuevo: Next.js 15 (App Router) + React 19 + TS strict + Tailwind v4 + iron-session',
      'Tokens "Precision Dark" portados (paleta OKLCH, fuente Geist sans+mono, radii consistentes)',
      'Components hand-rolled estilo shadcn (Button, Card, Input, Badge, Label, Sidebar, KPICard, Toast)',
      'Auth con iron-session: ADMIN_SESSION_SECRET fail-closed en producción, cookie httpOnly+secure+sameSite',
      'Pages: /login, /admin (dashboard), /admin/clients (kanban WhatsApp), /admin/client/[phone], /admin/clientes (CRM), /admin/review/[phone] (sandbox iframe)',
      'Pages: /admin/projects (lista+kanban), /admin/projects/[id], /admin/tasks (kanban+filtros), /admin/control, /admin/notifications, /admin/finanzas, /admin/changelog, /admin/documentos',
      'API: /api/webhook (con Twilio sig verify), /api/login, /api/logout, /api/health, /api/context, /api/reset, /api/start (admin token), /api/admin/* (auth)',
      'Lib portado a TS: db, agent, whatsapp, transcriber, calendar, drive, mailer, demos, reports, orchestrator, twilio-verify',
      'El Express legacy (src/) sigue corriendo en paralelo durante la migración — no se borra',
    ],
  },
  {
    version: '4.0.0',
    date: '2026-05-02',
    title: 'Rediseño Visual Completo — Precision Dark (legacy)',
    changes: [
      'Sistema de diseño "Precision Dark": paleta OKLCH (azul accent + verde/ámbar/rojo/púrpura semánticos), shadows multi-capa, radii consistentes',
      'Tipografía: fuente Geist (sans + mono) en todo el panel, números grandes en monospace',
      'Modo oscuro fijo (Precision Dark) — el toggle claro/oscuro fue removido',
      'Animaciones: page-in en cada navegación, count-up en KPIs del dashboard, modal-in con bounce, toast-in suave',
      'Sidebar: active state con barra lateral 3px accent (estilo Linear), badges semánticos, paleta tokens',
      'Pipeline kanban: avatares circulares colorimétricos, borde ámbar para demos pendientes, dot con glow por etapa',
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
    title: 'Upgrade Flowlu — Dark Mode + Command Palette + Sidebar Colapsable',
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

export default function ChangelogPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">Changelog</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Versiones e historia del producto</p>
      </div>

      <ol className="relative border-l-2 border-[var(--accent-dim)] ml-3 space-y-6">
        {CHANGELOG.map((entry, i) => (
          <li key={entry.version} className="ml-6 relative">
            <span className={`absolute -left-[2.05rem] w-3 h-3 rounded-full mt-1.5 ${
              entry.version === APP_VERSION ? 'bg-[var(--accent)] ring-4 ring-[var(--accent-dim)]' : 'bg-[var(--bg-card-2)]'
            }`} />
            <Card className="p-5">
              <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="mono text-base font-semibold text-foreground">v{entry.version}</span>
                    {entry.version === APP_VERSION && (
                      <Badge variant="success">Actual</Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{entry.date}</div>
                </div>
              </div>
              <h2 className="text-sm font-medium text-foreground mb-3">{entry.title}</h2>
              <ul className="space-y-1.5">
                {entry.changes.map((c, j) => (
                  <li key={j} className="text-xs text-muted-foreground flex items-start gap-2">
                    <svg className="w-3 h-3 text-[var(--green)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
