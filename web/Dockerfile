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
RUN mkdir -p /app/data/baileys-auth /app/data/demos /app/data/documents /app/data/project-files

# Entrypoint corre como root para chown/chmod del volume DESPUES del mount.
# Sin esto, Railway montea /app/data como root-owned y el proceso no puede escribir.
RUN printf '#!/bin/sh\nset -e\nmkdir -p /app/data/baileys-auth /app/data/demos /app/data/documents /app/data/project-files 2>/dev/null || true\nchmod -R 777 /app/data 2>/dev/null || true\nexec node node_modules/next/dist/bin/next start -p ${PORT:-3000}\n' > /entrypoint.sh \
    && chmod +x /entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

# Corremos como root (sin USER node) — necesario para escribir al volume montado.
# Riesgo aceptable: el container está aislado de Railway.
ENTRYPOINT ["/entrypoint.sh"]
