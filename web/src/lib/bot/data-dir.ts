// Resolver inteligente del DATA_DIR.
//
// Railway monta el volume en distintos paths según cómo lo configure el usuario.
// En vez de hardcodear, probamos varios candidates y elegimos el primero que
// permita escribir. Loguea claramente qué path eligió para debug.

import fs from 'fs';
import path from 'path';

let cached: string | null = null;

export function resolveDataDir(): string {
  if (cached) return cached;

  const candidates: string[] = [];

  // 1) Override explícito
  if (process.env.DATA_DIR) candidates.push(process.env.DATA_DIR);

  // 2) Path comunes de Railway volumes
  candidates.push(
    '/app/data',     // mount típico
    '/data',         // mount sin prefijo
    '/app/db',       // si el user llamó al volume "DB File Server" y lo mounto en /app/db
    '/db',           // variante
    path.resolve(process.cwd(), 'data'),       // junto al cwd
    path.resolve(process.cwd(), '..', 'data'), // un nivel arriba (legacy Express)
  );

  // 3) /tmp como fallback de última instancia (no persiste)
  candidates.push('/tmp/wpanalista-data');

  for (const dir of candidates) {
    if (!dir) continue;
    try {
      // Intentar crear si no existe
      if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch { /* sigo, el chmod abajo puede salvar */ }
      }
      // Si existe pero no podemos escribir, intentar chmod (si somos root)
      if (fs.existsSync(dir)) {
        try {
          const testFile = path.join(dir, '.wp-write-test');
          fs.writeFileSync(testFile, 'ok');
          fs.unlinkSync(testFile);
        } catch {
          // EACCES — intentar chmod en runtime
          try {
            fs.chmodSync(dir, 0o777);
            console.warn(`[data-dir] chmod 777 aplicado a ${dir}`);
            // Re-test
            const testFile = path.join(dir, '.wp-write-test');
            fs.writeFileSync(testFile, 'ok');
            fs.unlinkSync(testFile);
          } catch (chmodErr) {
            // Tampoco con chmod — saltar este dir
            const ce = chmodErr as NodeJS.ErrnoException;
            console.warn(`[data-dir] ✗ ${dir}: chmod tambien fallo (${ce.code})`);
            continue;
          }
        }
      } else {
        continue;
      }
      // ¡Funciona!
      cached = dir;
      const isFallback = dir === '/tmp/wpanalista-data';
      console.log(`[data-dir] ✅ Usando ${dir}${isFallback ? ' (FALLBACK /tmp — datos NO persisten)' : ''}`);
      return dir;
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      console.warn(`[data-dir] ✗ ${dir}: ${e.code || e.message}`);
    }
  }

  // No debería llegar acá (siempre /tmp funciona)
  throw new Error('Ningún DATA_DIR escribible disponible');
}

export function getDataDirSync(): string {
  return cached || resolveDataDir();
}
