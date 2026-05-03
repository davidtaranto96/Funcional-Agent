import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  authed?: boolean;
  user?: { name: string; email: string; photo?: string };
}

export const sessionOptions: SessionOptions = {
  cookieName: 'wpanalista_admin',
  password: process.env.ADMIN_SESSION_SECRET
    || (process.env.NODE_ENV === 'production'
        ? (() => { throw new Error('FATAL: ADMIN_SESSION_SECRET is required in production') })()
        : 'dev-only-fallback-secret-do-not-use-in-prod-please-set-ADMIN_SESSION_SECRET-32+chars'),
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
