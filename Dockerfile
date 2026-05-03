FROM node:20-slim

# Dependencias del sistema para @libsql/client (native bindings necesitan openssl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar solo package files primero (cache de layers)
COPY package*.json ./

# Instalar solo dependencias de produccion
RUN npm ci --omit=dev

# Copiar el resto del codigo (incluye entrypoint.sh)
COPY . .

# Crear data dir + subdirs (best-effort en build; el entrypoint los reasegura
# en runtime DESPUES del volume mount de Railway)
RUN mkdir -p /app/data/baileys-auth /app/data/demos /app/data/documents /app/data/project-files \
    && chown -R node:node /app \
    && chmod +x /app/entrypoint.sh

EXPOSE 3000

# Entrypoint corre como root, prepara dirs, y drop a usuario node antes de arrancar
ENTRYPOINT ["/app/entrypoint.sh"]
