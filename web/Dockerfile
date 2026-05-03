FROM node:20-slim AS deps

# Dependencias del sistema para @libsql/client (native bindings necesitan openssl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ─── Build stage ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Instalar TODAS las deps incluyendo dev para el build
COPY package*.json ./
RUN npm ci

COPY . .

# Build de Next.js (genera .next/)
RUN npm run build

# ─── Runtime stage ───────────────────────────────────────────────────────
FROM node:20-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Solo prod node_modules + build artifacts + package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# La data dir está en ../data (hermano del web/ en el monorepo)
# En Railway con un Volume, mountealo en /app/../data o configurá TURSO_DATABASE_URL
RUN mkdir -p /app/data && chown -R node:node /app

# Drop root
USER node

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
