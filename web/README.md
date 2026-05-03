# WPanalista — Web (Next.js 15 migration)

Migración del panel admin de Express SSR a Next.js 15 + React 19 + TS + Tailwind v4 + shadcn/ui patterns.

> **Status:** v5.0.0-alpha.1 — foundation only. Login + Dashboard + auth funcionando. El resto del admin sigue corriendo en `../src/admin.js` (legacy Express) hasta que se completen las próximas sesiones de migración.

## Stack

- **Next.js 15** (App Router, Turbopack)
- **React 19**
- **TypeScript** strict
- **Tailwind v4** (`@import "tailwindcss"` + `@theme` directive)
- **shadcn-style components** (hand-rolled, cero dependencia del CLI)
- **iron-session** para auth (cookie firmada, fail-closed en producción)
- **lucide-react** para íconos
- **Geist** sans + mono font
- **@libsql/client** para Turso (mismo schema que el legacy)

## Diseño

Tokens "Precision Dark" portados desde `../src/admin.js` (CSS layer). Paleta OKLCH, fuente Geist, active state lateral 3px estilo Linear.

Variables clave en `src/app/globals.css`:
- `--bg`, `--bg-card`, `--bg-inset`, `--bg-elevated`
- `--text-1` a `--text-4`
- `--accent`, `--accent-strong`, `--accent-dim`, `--accent-glow`
- `--green`, `--amber`, `--red`, `--purple`
- `--r-sm/md/lg/xl` radii (6/10/14/20px)
- `--h1-size/--h2-size/--h3-size` (22/16/13px)

## Quickstart

```bash
cd web
cp .env.example .env.local         # llenar valores
npm install                         # ya hecho — 520 packages
npm run dev                         # http://localhost:3000
```

Vas a `http://localhost:3000/login`, password = `ADMIN_PASSWORD` de tu `.env.local`.

## Estructura

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # root + Geist fonts
│   │   ├── page.tsx                # redirect → /admin
│   │   ├── globals.css             # Tailwind v4 + Precision Dark tokens
│   │   ├── login/
│   │   │   └── page.tsx            # Login con password + Google OAuth UI
│   │   ├── admin/
│   │   │   ├── layout.tsx          # Sidebar + auth gate
│   │   │   └── page.tsx            # Dashboard
│   │   └── api/
│   │       ├── login/route.ts      # POST password → session
│   │       ├── logout/route.ts     # POST destroy session
│   │       ├── health/route.ts     # GET status
│   │       ├── context/route.ts    # POST setear contexto cliente (admin token)
│   │       ├── reset/route.ts      # POST reset conversación (admin token)
│   │       └── start/route.ts      # POST mensaje proactivo (admin token)
│   ├── components/
│   │   ├── admin/
│   │   │   ├── Sidebar.tsx         # Nav lateral + mobile drawer
│   │   │   └── KPICard.tsx         # KPI card animado del dashboard
│   │   └── ui/
│   │       ├── button.tsx          # 6 variants
│   │       ├── card.tsx            # Card + sub-componentes
│   │       ├── input.tsx
│   │       ├── badge.tsx           # 6 variants semánticos
│   │       └── label.tsx           # @radix-ui/react-label
│   └── lib/
│       ├── db.ts                   # libsql + todas las queries (port de src/db.js)
│       ├── session.ts              # iron-session config + requireAuth + requireAdminToken
│       ├── utils.ts                # cn(), escapeHtml, phoneSlug, timeAgo, formatARS
│       ├── constants.ts            # STAGES, PROJECT_STATUS, TASK_STATUS
│       ├── whatsapp.ts             # Twilio (port)
│       ├── transcriber.ts          # Groq Whisper + URL allowlist (port + sec fix)
│       ├── agent.ts                # Claude conversational (port)
│       ├── mailer.ts               # Resend (port)
│       ├── calendar.ts             # Google Calendar (port)
│       └── drive.ts                # Google Drive (port)
├── public/
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── .env.example
```

## Seguridad portada del legacy

Todos los fixes del `/cso` audit (commit `0ffa6e5`) ya están en el código nuevo:

- ✅ `iron-session` reemplaza `express-session` — mismo cookie config (httpOnly, secure en prod, sameSite=lax, 7d maxAge)
- ✅ `ADMIN_SESSION_SECRET` fail-closed en `NODE_ENV=production`
- ✅ `requireAdminToken` en /api/context, /api/reset, /api/start
- ✅ Allowlist `*.twilio.com` + `redirect: manual` en transcriber
- 🟡 Twilio webhook signature verification — pendiente con la port de /api/webhook (próxima sesión)
- 🟡 Sandbox iframe en review demos — pendiente con la port de /admin/review (próxima sesión)

## Próximas sesiones (TODO)

1. **Backend completion** (~1h): `/api/webhook` con Twilio sig verify, port de `demos.ts` + `reports.ts` + `orchestrator.ts`
2. **Pipeline + Clients** (~1h): kanban de pipeline, lista de clientes, detalle de cliente con historial
3. **Projects + Tasks** (~1h): kanban + cards, detalle, drag-and-drop con SortableJS
4. **Centro de Control + Notifications** (~30min)
5. **Finanzas + Presupuesto + Documentos + Changelog** (~1h)
6. **Deploy** (~30min): `Dockerfile.web`, segundo Railway service, Twilio webhook URL switch

## Migración convivencia

Mientras se completa la migración:
- **Express legacy** (`../src/`) sigue corriendo en su propio puerto/Railway service. Maneja `/webhook`, `/admin/*`, `/start`, `/context`, `/reset`. NO se borra.
- **Next.js nuevo** (`web/`) se deploya como segundo service. Empieza sirviendo solo `/login` + `/admin` (dashboard).
- A medida que se migra cada vista, el routing se va switcheando.
- Cuando todo esté migrado, se cambia el dominio default a Next.js y se mata el Express.

## Notas

- `web/` y `../src/` comparten la misma DB (`../data/conversations.db` o Turso cloud).
- El `.env.local` del `web/` debe duplicar las mismas vars del `.env` de la raíz (no symlink — Next.js no lo resuelve igual).
- TypeScript strict — `npm run typecheck` pasa con 0 errores.
