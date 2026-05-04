FROM node:20-slim

# Dependencias del sistema (libssl para libsql, fontconfig para pdfkit)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates fontconfig \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (cache layer)
COPY package*.json ./

# Install ALL deps (incluye dev — necesarias para next build)
RUN npm ci

# Copy source
COPY . .

# Build de Next.js
RUN npm run build

# Limpiar dev deps post-build
RUN npm prune --omit=dev && npm cache clean --force

# Pre-crear subdirs del data volume (best-effort en build; el entrypoint los
# reasegura en runtime DESPUES del volume mount de Railway)
RUN mkdir -p /app/data/baileys-auth /app/data/demos /app/data/documents /app/data/project-files \
    && chmod +x /app/entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

# Corremos como root (sin USER node) — necesario para escribir al volume montado.
# El entrypoint hace chmod 777 sobre /app/data DESPUES del mount.
ENTRYPOINT ["/app/entrypoint.sh"]
