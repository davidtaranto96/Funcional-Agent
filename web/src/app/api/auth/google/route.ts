import { NextRequest, NextResponse } from 'next/server';
import { publicUrl } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(publicUrl(req, '/login?error=google_disabled'), { status: 303 });
  }

  // Permitir override por env GOOGLE_REDIRECT_URI (útil cuando el proxy reescribe
  // el host y el redirect_uri computado no matchea exactamente al de la consola).
  const callback = (process.env.GOOGLE_REDIRECT_URI || publicUrl(req, '/api/auth/google/callback').toString()).trim();

  console.log('[google-oauth] starting flow', {
    client_id_prefix: clientId.slice(0, 20) + '…',
    redirect_uri: callback,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, { status: 302 });
}
