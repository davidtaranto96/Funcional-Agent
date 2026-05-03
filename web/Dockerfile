FROM node:20-slim

# Dependencias del sistema para @libsql/client (native bindings necesitan openssl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (cache layer)
COPY package*.json ./

# Install ALL deps (incluye dev — necesarias para next build)
# Single-stage para no duplicar node_modules entre stages (Railway builder OOM con multi-stage)
RUN npm ci

# Copy source
COPY . .

# Build de Next.js (genera .next/)
RUN npm run build

# Limpiar dev deps post-build para slim el image final
RUN npm prune --omit=dev && npm cache clean --force

# Crear data dir y dar ownership al usuario node (existente en node:20-slim)
RUN mkdir -p /app/data && chown -R node:node /app

# Drop root
USER node

EXPOSE 3000

ENV NODE_ENV=production
# PORT lo setea Railway automáticamente, el start command lo lee con ${PORT:-3000}

CMD ["npm", "start"]
