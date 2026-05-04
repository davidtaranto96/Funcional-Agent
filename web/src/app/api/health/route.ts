import { NextResponse } from 'next/server';

export async function GET() {
  // Solo importamos getStatus si el bot está habilitado, para evitar cargar
  // baileys cuando no se usa.
  let waStatus: { connected: boolean; user: string | null; lastConnectedAt: string | null; authDirExists: boolean } | { enabled: false } = { enabled: false };
  if (process.env.ENABLE_BOT === '1') {
    try {
      const { getStatus } = await import('@/lib/bot/whatsapp');
      waStatus = getStatus();
    } catch {
      waStatus = { enabled: false };
    }
  }
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString(), whatsapp: waStatus });
}
