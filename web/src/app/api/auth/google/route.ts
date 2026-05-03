import { NextRequest, NextResponse } from 'next/server';
import { publicUrl } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(publicUrl(req, '/login?error=google_disabled'), { status: 303 });
  }

  // El callback usa la URL pública (respeta x-forwarded-host)
  const callback = publicUrl(req, '/api/auth/google/callback').toString();

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
