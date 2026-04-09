# WPanalista — Agente WhatsApp Comercial

Agente conversacional de WhatsApp que actúa como asistente comercial para gestión de leads de desarrollo de software.

## Setup

1. Clonar e instalar dependencias:
```bash
npm install
```

2. Crear `.env` a partir de `.env.example` y completar las API keys:
```bash
cp .env.example .env
```

3. Iniciar el servidor:
```bash
npm start
# o en modo desarrollo (auto-reload):
npm run dev
```

4. Exponer el webhook con ngrok:
```bash
ngrok http 3000
```

5. Configurar el webhook en Twilio:
   - Ir a la consola de Twilio → Messaging → WhatsApp sandbox
   - Setear el webhook a: `https://<tu-url-ngrok>/webhook`

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/webhook` | Webhook de Twilio para mensajes entrantes |
| POST | `/context` | Setear contexto previo de un cliente |
| POST | `/reset` | Reiniciar conversación de un cliente |
| POST | `/start` | Disparar el primer mensaje proactivo a un cliente |
| GET | `/health` | Health check |
| GET | `/admin` | Panel de gestión de clientes (requiere login) |
| GET | `/demos/:phone/:file` | Archivos estáticos de los demos (landing.html, whatsapp.png, propuesta.pdf) |

## Panel de administración

Después de que se genera un reporte, el sistema automáticamente:

1. Crea una carpeta del cliente en Google Drive
2. Genera 3 demos en paralelo:
   - **Landing HTML** personalizada con el proyecto del cliente
   - **Mockup de WhatsApp** (PNG) mostrando cómo se vería el asistente
   - **Mini-propuesta PDF** con timeline y precio estimado
3. Los guarda en Drive y local
4. Te manda email + WhatsApp con el link `/admin/review/:phone`

En el panel podés:
- Ver todos los clientes con su etapa (lead, calificado, demo enviado, ganado, perdido...)
- Ver la ficha completa de cada cliente con conversación, reporte y timeline
- Revisar los 3 demos embebidos y aprobar con un click
- Al aprobar, el sistema envía todo al cliente (WhatsApp + email)
- Regenerar demos manualmente
- Cambiar la etapa del cliente

Login con la contraseña definida en `ADMIN_PASSWORD`.

## Configurar Google Drive (Service Account)

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear un proyecto nuevo
3. Activar la **Google Drive API**
4. Crear un **Service Account** y descargar el JSON de credenciales
5. Convertir el JSON a base64: `cat creds.json | base64 -w 0` (o usar un conversor online)
6. Crear una carpeta en tu Google Drive (ej: "WPanalista-Clientes")
7. Compartirla con el email del service account (`xxx@xxx.iam.gserviceaccount.com`) con permiso de Editor
8. Copiar el ID de la carpeta desde la URL (la parte después de `/folders/`)
9. Poner en `.env`:
   - `GOOGLE_DRIVE_CREDENTIALS` = el JSON en base64
   - `GOOGLE_DRIVE_PARENT_FOLDER_ID` = el ID de la carpeta

Si Drive no está configurado, el sistema sigue funcionando igual (solo no sube los archivos a Drive, los guarda local).

### Setear contexto previo

```bash
curl -X POST http://localhost:3000/context \
  -H "Content-Type: application/json" \
  -d '{"phone": "+5491155551234", "context": {"nombre": "Juan", "referido": "Martin", "interes": "ecommerce"}}'
```

## Stack

- **Express** — servidor HTTP + webhook + panel admin
- **Twilio** — WhatsApp API (texto + media)
- **OpenAI Whisper** — transcripción de audios
- **Claude Haiku 4.5** — cerebro conversacional y generación de demos
- **Resend** — emails con adjuntos
- **sql.js** — estado de conversaciones (pure JS, sin compilación nativa)
- **googleapis** — integración con Google Drive (Service Account)
- **pdfkit** — generación de mini-propuestas PDF
- **node-html-to-image** — render de mockups de WhatsApp a PNG
- **express-session** — autenticación del panel admin

## Deploy en Railway

1. Crear proyecto en Railway
2. Setear todas las variables de `.env` en el dashboard
3. Railway detecta Node.js automáticamente y corre `npm start`
4. Configurar el webhook de Twilio con la URL de Railway
