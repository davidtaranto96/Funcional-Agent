import { NextResponse } from 'next/server';
import QRCode from 'qrcode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/auth/whatsapp-qr — devuelve el QR de Baileys como imagen PNG.
// Mucho más fácil de escanear que el ASCII de los logs.
//
// Estados posibles:
//   200 image/png  — QR disponible, escaneá con tu cel
//   404 + JSON      — bot no inicializado (ENABLE_BOT != 1) o ya conectado
//   503 + JSON      — bot inicializado pero no genera QR todavía
export async function GET() {
  if (process.env.ENABLE_BOT !== '1') {
    return NextResponse.json({
      error: 'Bot no habilitado',
      hint: 'Setea ENABLE_BOT=1 en Railway → NEXT.JS → Variables.',
    }, { status: 404 });
  }

  let getStatus: () => { connected: boolean; qrAvailable: boolean };
  let getLatestQR: () => { qr: string | null; at: Date | null };
  try {
    const mod = await import('@/lib/bot/whatsapp');
    getStatus = mod.getStatus;
    getLatestQR = mod.getLatestQR;
  } catch (err) {
    return NextResponse.json({
      error: 'No pude cargar el modulo de whatsapp',
      detail: (err as Error).message,
    }, { status: 500 });
  }

  const status = getStatus();
  if (status.connected) {
    return NextResponse.json({
      ok: true,
      connected: true,
      message: 'WhatsApp ya está conectado, no se necesita QR.',
    }, { status: 200 });
  }

  const { qr, at } = getLatestQR();
  if (!qr) {
    return NextResponse.json({
      error: 'Todavía no se generó QR',
      hint: 'Esperá 10-20s y refrescá. Baileys está inicializando la conexión.',
    }, { status: 503 });
  }

  // Generar PNG del QR. Width 512px = chic y rápido de escanear.
  try {
    const png = await QRCode.toBuffer(qr, {
      type: 'png',
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
    // Cast Buffer -> Uint8Array (compat con Web Response API en Next.js 15)
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, must-revalidate',
        'X-QR-Generated-At': at?.toISOString() || 'unknown',
      },
    });
  } catch (err) {
    return NextResponse.json({
      error: 'No pude generar la imagen del QR',
      detail: (err as Error).message,
    }, { status: 500 });
  }
}
