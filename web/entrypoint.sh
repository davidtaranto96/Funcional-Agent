#!/bin/sh
# Entrypoint del container Next.js — corre como root, prepara perms del volume,
# después arranca next start.
set -e

echo "═══════════════════════════════════════════════════════"
echo "  WPanalista entrypoint v5.1.0"
echo "  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "  user: $(whoami) (uid=$(id -u))"
echo "═══════════════════════════════════════════════════════"

# Pre-crear subdirs del volume (idempotente, OK si ya existen)
mkdir -p /app/data/baileys-auth /app/data/demos /app/data/documents /app/data/project-files 2>/dev/null || true

# CRITICO: chmod 777 en runtime, DESPUES del volume mount de Railway. Sin esto
# el proceso Next.js no tiene permisos para escribir al volume.
chmod -R 777 /app/data 2>/dev/null || echo "[entrypoint] WARN: chmod fallo (puede ser ok si ya tiene perms)"

# Log final del estado del volume
echo "[entrypoint] /app/data permisos:"
ls -ld /app/data 2>/dev/null || echo "  (no existe)"
echo "[entrypoint] Subdirs:"
ls -ld /app/data/baileys-auth /app/data/demos /app/data/documents /app/data/project-files 2>/dev/null | sed 's/^/  /'

echo "[entrypoint] Arrancando Next.js..."
exec node node_modules/next/dist/bin/next start -p ${PORT:-3000}
