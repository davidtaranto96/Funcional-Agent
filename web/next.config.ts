import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Permite cargar pdfkit y libsql del lado server
  serverExternalPackages: ['pdfkit', '@libsql/client', 'googleapis'],
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
