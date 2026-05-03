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
};

export default config;
