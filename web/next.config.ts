import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Paquetes que NO deben ser bundled por webpack — se cargan via require()
  // en runtime desde node_modules. Critico para libs con native bindings o
  // que romperían si webpack las procesa (ej. Baileys + ws).
  serverExternalPackages: [
    'pdfkit',
    '@libsql/client',
    'googleapis',
    '@whiskeysockets/baileys',
    'ws',
    'pino',
    'qrcode-terminal',
    'sharp',
    'libsignal',
  ],
  experimental: {
    // Server actions con archivos grandes (audio uploads)
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  // El admin está detrás de proxy en Railway
  poweredByHeader: false,
  // ESLint y TS errors NO matan el build de prod (deploy en Railway).
  // Igual los chequeás en local con `npm run lint` y `npm run typecheck`.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default config;
