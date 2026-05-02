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

(Las entradas se agregan al implementar cada cambio)
