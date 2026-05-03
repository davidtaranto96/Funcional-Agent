import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
      {/* Radial glow accent — signature de Precision Dark */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, var(--accent-glow), transparent 70%)',
          animation: 'pd-glow-breathe 6s ease-in-out infinite',
        }}
        aria-hidden
      />
      <div className="relative w-full max-w-sm">
        <div className="bg-card border border-[var(--border)] rounded-xl shadow-[var(--shadow-elev)] p-8 pd-page-in">
          <div className="text-center mb-7">
            <div className="inline-grid place-items-center w-12 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-lg mb-3">
              DT
            </div>
            <h1 className="text-foreground font-semibold text-base mb-1">DT Systems</h1>
            <p className="text-xs text-muted-foreground">Panel de control · v5.0.0-alpha</p>
          </div>

          {errorMsg && (
            <div className="mb-4 px-3 py-2 rounded-md bg-[oklch(0.62_0.22_27_/_0.10)] border border-[oklch(0.62_0.22_27_/_0.30)] text-[var(--red)] text-xs">
              {errorMsg}
            </div>
          )}

          <form method="POST" action="/api/login" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoFocus
                autoComplete="current-password"
                required
                className="h-10"
              />
            </div>
            <Button type="submit" className="w-full" size="lg">
              <span className="btn-text">Entrar</span>
            </Button>
          </form>

          {googleEnabled && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex-1 h-px bg-[var(--border)]" />
                <span>o</span>
                <span className="flex-1 h-px bg-[var(--border)]" />
              </div>
              <Button asChild variant="outline" className="w-full" size="lg">
                <Link href="/api/auth/google">
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Continuar con Google</span>
                </Link>
              </Button>
            </>
          )}
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-4">
          Single-user panel · Acceso restringido
        </p>
      </div>
    </main>
  );
}
