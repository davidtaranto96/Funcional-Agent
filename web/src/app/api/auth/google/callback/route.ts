import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { publicUrl } from '@/lib/utils';

interface GoogleTokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  email?: string;
  name?: string;
  picture?: string;
  verified_email?: boolean;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  // Si el usuario canceló o hay error
  if (error || !code) {
    return NextResponse.redirect(publicUrl(req, '/login?error=2'), { status: 303 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(publicUrl(req, '/login?error=google_disabled'), { status: 303 });
  }

  const callback = publicUrl(req, '/api/auth/google/callback').toString();

  // 1) Intercambiar code por access_token
  let tokenData: GoogleTokenResponse;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callback,
        grant_type: 'authorization_code',
      }).toString(),
    });
    tokenData = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[google-oauth] token exchange failed', tokenData);
      return NextResponse.redirect(publicUrl(req, '/login?error=2'), { status: 303 });
    }
  } catch (e) {
    console.error('[google-oauth] token request error', e);
    return NextResponse.redirect(publicUrl(req, '/login?error=2'), { status: 303 });
  }

  // 2) Obtener perfil del usuario
  let user: GoogleUserInfo;
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    user = (await userRes.json()) as GoogleUserInfo;
    if (!userRes.ok || !user.email) {
      console.error('[google-oauth] userinfo failed', user);
      return NextResponse.redirect(publicUrl(req, '/login?error=2'), { status: 303 });
    }
  } catch (e) {
    console.error('[google-oauth] userinfo error', e);
    return NextResponse.redirect(publicUrl(req, '/login?error=2'), { status: 303 });
  }

  // 3) Validar email contra ADMIN_ALLOWED_EMAILS
  const email = (user.email || '').toLowerCase();
  const allowed = (process.env.ADMIN_ALLOWED_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length > 0 && !allowed.includes(email)) {
    console.warn(`[google-oauth] email no autorizado: ${email}`);
    return NextResponse.redirect(publicUrl(req, '/login?error=2'), { status: 303 });
  }

  // 4) Crear sesión
  const session = await getSession();
  session.authed = true;
  session.user = {
    name: user.name || email.split('@')[0],
    email,
    photo: user.picture,
  };
  await session.save();

  return NextResponse.redirect(publicUrl(req, '/admin'), { status: 303 });
}
