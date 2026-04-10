FROM node:20-slim

# Dependencias del sistema para @libsql/client (native bindings necesitan openssl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar solo package files primero (cache de layers)
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --omit=dev

# Copiar el resto del código
COPY . .

EXPOSE 3000

CMD ["node", "src/index.js"]
