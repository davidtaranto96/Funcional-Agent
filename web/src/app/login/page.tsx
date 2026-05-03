import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/session';

const ERRORS: Record<string, string> = {
  '1': 'Contraseña incorrecta',
  '2': 'Email no autorizado para acceder al panel',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getSession();
  if (session.authed) redirect('/admin');

  const params = await searchParams;
  const errorMsg = params.error ? ERRORS[params.error] : null;
  const googleEnabled = !!process.env.GOOGLE_CLIENT_ID;

  return (
    <main id="main" className="min-h-[100dvh] grid place-items-center px-4 relative overflow-hidden">
      {/* Glow radial principal — pulsa lento, signature de Precision Dark */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 50%, var(--accent-glow), transparent 60%)',
          animation: 'pd-glow-breathe 6s ease-in-out infinite',
        }}
        aria-hidden
      />
      {/* Glow radial secundario en bottom */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 100%, oklch(0.62 0.18 290 / 0.20), transparent 70%)',
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-[400px]">
        {/* Brand */}
        <div className="text-center mb-7 pd-page-in">
          <div
            className="inline-grid place-items-center w-[60px] h-[60px] rounded-[14px] bg-primary text-white text-lg font-extrabold mb-3 mx-auto"
            style={{ boxShadow: '0 8px 24px var(--accent-glow), 0 0 0 1px rgba(255,255,255,0.06) inset' }}
          >
            DT
          </div>
          <h1 className="text-foreground font-bold text-[20px] tracking-tight">DT Systems</h1>
          <p className="text-[12px] text-muted-foreground mt-1 mono">CRM &amp; Proyectos</p>
        </div>

        {/* Card */}
        <div
          className="bg-card border border-[var(--border)] rounded-[var(--r-xl)] shadow-[var(--shadow-elev)] p-7 pd-page-in"
          style={{ animationDelay: '60ms' }}
        >
          {googleEnabled && (
            <>
              <a
                href="/api/auth/google"
                className="w-full flex items-center justify-center gap-2.5 h-11 rounded-md bg-[var(--bg-card-2)] border border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] transition-colors text-[13px] font-medium text-foreground"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar con Google
              </a>

              <div className="my-5 flex items-center gap-3">
                <span className="flex-1 h-px bg-[var(--border)]" />
                <span className="mono text-[10px] text-muted-foreground uppercase tracking-wider">o con contraseña</span>
                <span className="flex-1 h-px bg-[var(--border)]" />
              </div>
            </>
          )}

          {errorMsg && (
            <div className="mb-4 px-3 py-2 rounded-md bg-[oklch(0.62_0.22_27_/_0.10)] border border-[oklch(0.62_0.22_27_/_0.30)] text-[var(--red)] text-[12px] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)] flex-shrink-0" />
              {errorMsg}
            </div>
          )}

          <form method="POST" action="/api/login" className="space-y-3">
            <div>
              <label htmlFor="password" className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoFocus
                autoComplete="current-password"
                required
                className="w-full h-11 px-3.5 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-[15px] text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)]"
                style={{ letterSpacing: '2px' }}
              />
            </div>
            <button
              type="submit"
              className="w-full h-11 rounded-md bg-primary text-white text-[14px] font-semibold transition-all hover:brightness-110 active:scale-[0.99]"
              style={{ boxShadow: '0 2px 12px var(--accent-glow)' }}
            >
              Acceder al panel
            </button>
          </form>

          {!googleEnabled && (
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              Login con Google deshabilitado.{' '}
              <Link href="https://railway.app/" className="text-[var(--accent-strong)] hover:underline">
                Configurá GOOGLE_CLIENT_ID
              </Link>
            </p>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground mono mt-5 uppercase tracking-wider">
          v5.0.0-alpha · Solo uso interno
        </p>
      </div>
    </main>
  );
}
