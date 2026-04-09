FROM node:20-alpine

WORKDIR /app

# Copiar solo package files primero (cache de layers)
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --omit=dev

# Copiar el resto del código
COPY . .

EXPOSE 3000

CMD ["node", "src/index.js"]
