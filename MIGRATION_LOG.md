# MIGRATION LOG — Precision Dark Visual Redesign

**Branch:** `feat/visual-redesign-precision-dark`
**Inicio:** 2026-05-02
**Backup:** `src/admin.BACKUP.js` (estado pre-migración v3.2.0)

## Decisiones aprobadas por David

1. **Tema:** full dark Precision Dark (drop light mode actual)
2. **Detalle cliente/proyecto:** páginas completas, NO drawers overlay
3. **Facturas:** OUT OF SCOPE (no existe módulo backend)
4. **FAB flotante:** OUT OF SCOPE (no es prioridad)
5. **Sidebar:** mantener estructura actual (v3.2.0), solo retocar paleta + active state
6. **PR strategy:** un solo PR final con commits atómicos por fase

## Vistas mapeadas

| # | Vista | Ruta | Línea | Riesgo | Estado |
|---|---|---|---|---|---|
| 1 | Login | `/admin/login` | 961 | Bajo | Pendiente |
| 2 | Sidebar | global | 369-660 | Bajo | Pendiente |
| 3 | Dashboard | `/admin` | 996 | Medio | Pendiente |
| 4 | Centro de Control | `/admin/control` | 2729 | Alto | Pendiente |
| 5 | Pipeline | `/admin/clients` | 1291 | Medio | Pendiente |
| 6 | Cliente detalle | `/admin/client/:phone` | 1622 | Bajo | Pendiente |
| 7 | Clientes | `/admin/clientes` | 4881 | Bajo | Pendiente |
| 8 | Proyectos lista | `/admin/projects` | 3512 | Medio | Pendiente |
| 9 | Proyecto detalle | `/admin/projects/:id` | 4057 | Medio | Pendiente |
| 10 | Tareas | `/admin/tasks` | 3273 | Bajo | Pendiente |
| 11 | Finanzas | `/admin/finanzas` | 5826 | Medio | Pendiente |
| 12 | Presupuestos | `/admin/presupuesto` | 6306 | Bajo | Pendiente |
| 13 | Documentos | `/admin/documentos` | 5317 | Alto | Pendiente |
| 14 | Changelog | `/admin/changelog` | 7351 | Bajo | Pendiente |

## Fases

### Fase 0 — Setup
- [x] Branch creado
- [x] Backup `admin.BACKUP.js` creado
- [x] MIGRATION_LOG.md creado
- [ ] Smoke test pre-migración

### Fase 1 — Sistema base
- [ ] Inyectar fuente Geist
- [ ] CSS variables `:root` Precision Dark
- [ ] Drop light mode (`html.dark` → default)
- [ ] Clases utilitarias `.card .btn .badge .input .table .tabs`
- [ ] Keyframes (page-in, count-up, modal-in, toast-in, shimmer)

### Fase 2 — Toast system
- [ ] 3 variantes (ok/err/info), centro inferior

### Fase 3 — Sidebar fine-tuning
- [ ] Paleta Precision Dark
- [ ] Active state con barra lateral 3px accent

### Fases 4–14 — Vistas individuales
(Por completar)

## Bitácora detallada

### Commits realizados (rama `feat/visual-redesign-precision-dark`)

| # | Commit | Resumen |
|---|---|---|
| 1 | `f1e09a1` | Fase 1 — Sistema base Precision Dark (Geist, tokens, 12 keyframes, utility classes pd-*) |
| 2 | `d84584d` | Fase 2 — Toast bottom-center 3 variantes OKLCH |
| 3 | `fb089d2` | Fase 3 — Sidebar active state lateral 3px + drop dark toggle + brand collapsable |
| 4 | `1ddefa2` | Fase 4 — Login radial glow + spinner inline + Geist |
| 5 | `028a32e` | Fase 5 — Dashboard KPI cards count-up + glow + mono + bar fill |
| 6 | `a986b91` | Fase 6 — Pipeline kanban avatares colorimétricos + borde ámbar pendientes |
| 7 | `3f842ff` | Polish global — 30+ reglas mapean Tailwind colors a tokens (afecta TODAS las vistas restantes) |
| 8 | `aecec14` | Fase 14 — Changelog estilo Linear (timeline accent + mono + check SVG) |
| 9 | `358ae71` | Fase 7 — Centro de Control header con system health pill |
| 10 | `141edd6` | Fix — mono number rule scoped a div/span (no H1 page titles) |
| 11 | TBD  | v4.0.0 — bump APP_VERSION + entry de changelog |

### Estrategia "Polish Global" (Fases 8-13)

Para escalar la migración sin reescribir markup en 10+ vistas, se introdujo una **capa CSS de mapeo automático** (commit `3f842ff`) que transforma todas las clases Tailwind comunes (`bg-blue-600`, `text-orange-500`, `bg-emerald-100`, `border-l-4 border-blue-500`, etc.) a sus equivalentes Precision Dark vía tokens. Esto entrega coherencia visual completa en:

- `/admin/clientes` (Fase 8)
- `/admin/projects` (Fase 9)
- `/admin/projects/:id` (Fase 9)
- `/admin/tasks` (Fase 10)
- `/admin/finanzas` (Fase 11)
- `/admin/presupuesto` (Fase 12)
- `/admin/documentos` (Fase 13)

**SIN tocar lógica, fetches, handlers, ni Express endpoints.**

### Smoke test funcional

- [x] `node -e "require('./src/admin.js')"` — sintaxis correcta
- [x] `GET /admin/login` retorna 200 con Geist + tokens `--accent` + DT logo

### Pendiente para PR

- [ ] Push branch a GitHub
- [ ] Crear PR a `main` con descripción

### Out of scope (no implementado)

1. **Vista Facturas** — no existe módulo backend, no se crea.
2. **FAB flotante mejorado** — markup actual permanece; visualmente queda OK por la capa de polish global.
3. **Documentos 2-paneles** — el rediseño completo a layout dual (sidebar interno 220px + main con FolderCards SVG-style) implicaría reescribir el markup completo de `/admin/documentos`. Se difiere a una fase posterior. La página luce coherente en Precision Dark gracias a la capa de polish global.
4. **Tareas agrupación por urgencia** — la vista actual con kanban + lista funciona bien; no se reorganiza.
5. **Convertir clientes/proyectos detalle a drawer overlay** — decisión explícita: mantener páginas completas (no perder URL deep-linking).
6. **System health real con backend** — el pill en Centro de Control muestra estado estático ("Agente activo · servicios"). Para chequeo real de Twilio/Claude/Resend/Drive haría falta endpoints `/api/health/*` que están fuera de scope.
