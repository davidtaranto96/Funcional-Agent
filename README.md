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
| GET | `/health` | Health check |

### Setear contexto previo

```bash
curl -X POST http://localhost:3000/context \
  -H "Content-Type: application/json" \
  -d '{"phone": "+5491155551234", "context": {"nombre": "Juan", "referido": "Martin", "interes": "ecommerce"}}'
```

## Stack

- **Express** — servidor HTTP + webhook
- **Twilio** — WhatsApp API
- **OpenAI Whisper** — transcripción de audios
- **Claude Sonnet** — cerebro conversacional
- **Resend** — emails
- **SQLite** — estado de conversaciones

## Deploy en Railway

1. Crear proyecto en Railway
2. Setear todas las variables de `.env` en el dashboard
3. Railway detecta Node.js automáticamente y corre `npm start`
4. Configurar el webhook de Twilio con la URL de Railway
