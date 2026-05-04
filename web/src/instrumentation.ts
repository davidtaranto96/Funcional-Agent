// Next.js 15 instrumentation hook — corre 1 vez al arrancar el server.
// Acá iniciamos Baileys (WhatsApp), el follow-up checker, y dejamos los
// procesos vivos junto al server Next.js.

export async function register() {
  // Solo en el runtime Node.js (no en Edge)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Solo arrancamos el bot si está habilitado (env var ENABLE_BOT=1).
  // Esto permite tener Next.js-only deploys (ej. preview branches) sin
  // arrancar Baileys, que requiere un volume persistente.
  if (process.env.ENABLE_BOT !== '1') {
    console.log('[instrumentation] ENABLE_BOT != 1 — bot NO arrancado');
    return;
  }

  // Idempotencia: globalThis flag para evitar double-init en HMR/dev
  const g = globalThis as unknown as { __wpBotStarted?: boolean };
  if (g.__wpBotStarted) {
    console.log('[instrumentation] Bot ya iniciado, skip');
    return;
  }
  g.__wpBotStarted = true;

  try {
    const { startBot } = await import('@/lib/bot/start');
    await startBot();
  } catch (err) {
    console.error('[instrumentation] FATAL: no pude arrancar el bot:', err);
  }
}
