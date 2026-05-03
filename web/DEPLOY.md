# Deploy — wpanalista-web (Next.js)

Esta guía configura un **segundo Railway service** para el panel Next.js, conviviendo con el Express legacy en el mismo proyecto Railway.

## Pre-requisitos

- Tu proyecto Railway actual con el Express legacy ya deploya correctamente desde `/src/index.js`
- Acceso al dashboard de Railway
- Las env vars que ya tenés en el legacy

## Paso 1 — Crear el segundo service

1. Andá a tu **proyecto Railway** (el mismo donde está el legacy).
2. Click en **+ New** → **GitHub repo** → seleccioná el mismo repo (`davidtaranto96/Funcional-Agent`).
3. En **Settings** del nuevo service:
   - **Root Directory:** `web`
   - **Build Command:** (vacío — el `Dockerfile` lo maneja)
   - **Start Command:** (vacío — el `Dockerfile` lo maneja)
   - **Watch Paths:** `web/**` (para no triggear redeploy del web cuando cambies `src/` y viceversa)
4. **Generate Domain** → te da algo tipo `wpanalista-web.up.railway.app`.

## Paso 2 — Variables de entorno

En el nuevo service, agregá las mismas vars del legacy (podés copy-paste desde el legacy service):

```bash
# Auth (NUEVO secret para sessions del Next.js — distinto al del Express por seguridad)
ADMIN_PASSWORD=                            # mismo que el legacy
ADMIN_SESSION_SECRET=                      # NUEVO: openssl rand -hex 32 (no reutilices el del Express)
ADMIN_API_TOKEN=                           # mismo que el legacy
ADMIN_ALLOWED_EMAILS=                      # opcional, mismo que el legacy

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

# LLMs
ANTHROPIC_API_KEY=
GROQ_API_KEY=

# Email
RESEND_API_KEY=
RESEND_FROM=

# Notif
DAVID_PHONE=
DAVID_EMAIL=

# Turso (cloud DB compartida con el legacy)
TURSO_DATABASE_URL=                        # OBLIGATORIO si querés que ambos services compartan datos
TURSO_AUTH_TOKEN=

# App URL (apunta al dominio de ESTE service)
APP_URL=https://wpanalista-web.up.railway.app

# Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_DRIVE_CREDENTIALS=
GOOGLE_DRIVE_PARENT_FOLDER_ID=

# Estos se setean automáticamente
NODE_ENV=production
PORT=3000                                  # Railway lo override
```

> **IMPORTANTE:** `TURSO_DATABASE_URL` debe estar seteado en AMBOS services para que vean la misma base de datos. Si lo dejás vacío, cada service usa su propio SQLite local en su volumen → datos desconectados.

## Paso 3 — Compartir la carpeta /data (solo si NO usás Turso cloud)

Si usás SQLite local, tenés dos opciones:

**Opción A (recomendada):** migrar a Turso cloud. Free tier: 9GB, 500 DBs. `npx turso db create wpanalista` → te da `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.

**Opción B (más complicada):** crear un Railway Volume y montarlo en ambos services en el mismo path. Documentación: https://docs.railway.app/reference/volumes

## Paso 4 — Verificar el deploy

```bash
# Health check del nuevo service
curl https://wpanalista-web.up.railway.app/api/health

# Esperado: {"status":"ok","timestamp":"..."}
```

Andá a `https://wpanalista-web.up.railway.app/login`, password = tu `ADMIN_PASSWORD`. Deberías ver el dashboard nuevo con tus datos reales.

## Paso 5 — Opcional: cambiar el webhook de Twilio al nuevo service

Si querés que el `/api/webhook` del Next.js maneje los mensajes (con la firma Twilio validada), apuntá Twilio al nuevo dominio:

1. Dashboard de Twilio → **Messaging** → **Senders** → tu WhatsApp number
2. **Webhook URL:** `https://wpanalista-web.up.railway.app/api/webhook` (POST)
3. Save.

> **MUY IMPORTANTE:** cambiar el webhook redirige TODOS los mensajes al nuevo service. Si algo falla en el Next.js, se cortan las conversaciones con clientes en producción. Probá primero en el sandbox de Twilio.

Si preferís dejar el `/webhook` en el legacy un tiempo más, lo dejás en `https://wpanalista.up.railway.app/webhook` (Express). Ambos services pueden coexistir.

## Paso 6 — Migrar el dominio principal (cuando estés listo)

Cuando tengas confianza en el nuevo panel:
1. En Railway, agregá tu dominio custom al nuevo service
2. Removelo del legacy
3. El legacy queda solo escuchando en el subdominio `xxx.up.railway.app` por si tenés que hacer rollback

## Rollback

Si rompés algo y necesitás volver al legacy:
- Cambia el webhook de Twilio de vuelta al legacy (`/webhook` en el dominio del Express)
- Cambia el dominio principal en Railway
- El nuevo service queda parado pero deployable

## Notas

- El **build** de Next.js consume ~600MB RAM. Asegurate de que tu plan de Railway lo banque.
- El bundle final del runtime es ~200MB con node_modules + .next.
- `npm start` en producción corre `next start -p $PORT`. Railway le pasa $PORT automáticamente.
- El healthcheck de Railway pega a `/api/health` cada N segundos para validar que el service está vivo.
