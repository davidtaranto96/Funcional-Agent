#!/bin/sh
# Entrypoint del contenedor — se ejecuta como root para preparar el volume
# de Railway y despues dropea privilegios al usuario node.
set -e

# Asegurar que los subdirs del volume existen con permisos correctos.
# Esto corre DESPUES del mount de Railway, asi que el chown del Dockerfile
# (que ocurre en build time, antes del mount) no aplica al volume.
mkdir -p /app/data/baileys-auth /app/data/demos /app/data/documents /app/data/project-files 2>/dev/null || true
chown -R node:node /app/data 2>/dev/null || true

# Drop a usuario node y arrancar la app
exec su -s /bin/sh node -c "node src/index.js"
