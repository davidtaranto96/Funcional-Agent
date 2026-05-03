import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export interface SessionData {
  authed?: boolean;
  user?: { name: string; email: string; photo?: string };
}

let cachedSecret: string | null = null;

function getSecret(): string {
  if (cachedSecret) return cachedSecret;

  const env = process.env.ADMIN_SESSION_SECRET;
  if (env && env.length > 0) {
    if (env.length < 32) {
      throw new Error(
        `ADMIN_SESSION_SECRET es de ${env.length} chars pero iron-session pide mínimo 32. ` +
        `Generá uno nuevo con:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  ` +
        `y reemplazalo en web/.env.local`,
      );
    }
    cachedSecret = env;
    return cachedSecret;
  }

  // Build phase de Next.js: nunca corre requests reales, solo prerender.
  // Devolvemos dummy para que el build no rompa. En runtime real (server start)
  // la var DEBE estar seteada — si no, el primer request va a fallar.
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    console.warn('[session] build phase sin ADMIN_SESSION_SECRET — usando dummy. Asegurate de setearla en runtime.');
    cachedSecret = crypto.randomBytes(32).toString('hex');
    return cachedSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: ADMIN_SESSION_SECRET es requerido en producción (mínimo 32 chars)');
  }

  // Dev fallback: secret efímero per process. Las sesiones se invalidan al reiniciar.
  console.warn('[session] ADMIN_SESSION_SECRET no seteado — usando secret efímero. Sesiones se invalidan al reiniciar el dev server.');
  cachedSecret = crypto.randomBytes(32).toString('hex');
  return cachedSecret;
}

export const sessionOptions: SessionOptions = {
  cookieName: 'wpanalista_admin',
  // Lazy getter: resuelve cuando iron-session lee la prop, no al cargar el módulo.
  // Esto permite mensajes de error claros en el primer request, no al boot.
  get password() { return getSecret(); },
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
  },
};

export async function getSession() {
  const c = await cookies();
  return getIronSession<SessionData>(c, sessionOptions);
}

export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  if (!session.authed) {
    const { redirect } = await import('next/navigation');
    redirect('/login');
  }
  return session;
}

export function requireAdminToken(req: Request): { ok: boolean; status?: number; body?: { error: string } } {
  const url = new URL(req.url);
  const token = req.headers.get('x-admin-token') || url.searchParams.get('admin_token');
  if (!process.env.ADMIN_API_TOKEN || token !== process.env.ADMIN_API_TOKEN) {
    return { ok: false, status: 401, body: { error: 'unauthorized' } };
  }
  return { ok: true };
}
