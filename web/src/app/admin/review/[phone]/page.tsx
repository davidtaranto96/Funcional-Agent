import { notFound } from 'next/navigation';
import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import * as db from '@/lib/db';
import { Button } from '@/components/ui/button';
import { phoneSlug } from '@/lib/utils';
import { MicTextarea } from './ReviewActions';

export const dynamic = 'force-dynamic';

interface VersionEntry { version: number; date: string; notes: string }

export default async function ReviewPage({ params }: { params: Promise<{ phone: string }> }) {
  const { phone } = await params;
  const decoded = decodeURIComponent(phone);
  const conv = await db.getConversation(decoded);
  if (!conv) notFound();

  const slug = phoneSlug(decoded);
  const localDir = path.resolve(process.cwd(), '..', 'data', 'demos', slug);
  const hasLanding = fs.existsSync(path.join(localDir, 'landing.html'));
  const hasWA = fs.existsSync(path.join(localDir, 'whatsapp.html'));
  const hasPDF = fs.existsSync(path.join(localDir, 'propuesta.pdf'));

  let versions: VersionEntry[] = [];
  try {
    const vf = path.join(localDir, 'versions.json');
    if (fs.existsSync(vf)) versions = JSON.parse(fs.readFileSync(vf, 'utf-8'));
  } catch {}

  const nombre = conv.report?.cliente?.nombre || decoded;

  const items: Array<{ title: string; url: string; type: 'iframe' | 'pdf' }> = [];
  if (hasLanding) items.push({ title: '🌐 Landing HTML', url: `/demos/${slug}/landing.html`, type: 'iframe' });
  if (hasWA)      items.push({ title: '💬 Mockup WhatsApp', url: `/demos/${slug}/whatsapp.html`, type: 'iframe' });
  if (hasPDF)     items.push({ title: '📄 Mini-propuesta PDF', url: `/demos/${slug}/propuesta.pdf`, type: 'pdf' });

  return (
    <div className="max-w-[1400px] mx-auto">
      <Link href={`/admin/client/${encodeURIComponent(decoded)}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        ← {nombre}
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">Revisar demos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{nombre} · {decoded}</p>
        </div>
      </div>

      {conv.demo_notes && (
        <div className="bg-[oklch(0.62_0.18_290_/_0.10)] border border-[oklch(0.62_0.18_290_/_0.30)] rounded-xl p-4 mb-5">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--purple)] mb-1">✏ Correcciones pedidas antes</div>
          <p className="text-sm text-foreground whitespace-pre-line">{conv.demo_notes}</p>
        </div>
      )}

      {versions.length > 0 && (
        <div className="bg-card rounded-xl border border-[var(--border)] p-4 mb-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[length:var(--h2-size)] font-semibold">Versiones anteriores</h2>
            <span className="text-[10px] text-muted-foreground mono">{versions.length}</span>
          </div>
          <div className="space-y-2">
            {versions.map(v => {
              const d = new Date(v.date);
              const dateStr = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
              return (
                <div key={v.version} className="flex items-center justify-between bg-[var(--bg-inset)] rounded-md px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground">v{v.version}</span>
                    <span className="text-[10px] text-muted-foreground">{dateStr}</span>
                    {v.notes && <span className="text-[10px] text-[var(--purple)] italic truncate">{v.notes}</span>}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {fs.existsSync(path.join(localDir, `v${v.version}`, 'landing.html')) && (
                      <a href={`/demos/${slug}/v${v.version}/landing.html`} target="_blank" rel="noopener" className="text-[10px] px-2 py-0.5 bg-card border border-[var(--border-strong)] rounded text-muted-foreground hover:text-foreground">Landing</a>
                    )}
                    {fs.existsSync(path.join(localDir, `v${v.version}`, 'whatsapp.html')) && (
                      <a href={`/demos/${slug}/v${v.version}/whatsapp.html`} target="_blank" rel="noopener" className="text-[10px] px-2 py-0.5 bg-card border border-[var(--border-strong)] rounded text-muted-foreground hover:text-foreground">WA</a>
                    )}
                    {fs.existsSync(path.join(localDir, `v${v.version}`, 'propuesta.pdf')) && (
                      <a href={`/demos/${slug}/v${v.version}/propuesta.pdf`} target="_blank" rel="noopener" className="text-[10px] px-2 py-0.5 bg-card border border-[var(--border-strong)] rounded text-muted-foreground hover:text-foreground">PDF</a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-[oklch(0.74_0.16_75_/_0.10)] border border-[oklch(0.74_0.16_75_/_0.30)] rounded-xl p-5 text-center text-sm text-foreground mb-5">
          ⚠ No hay archivos de demo generados todavía para este cliente.
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${items.length > 1 ? `lg:grid-cols-${Math.min(items.length, 3)}` : ''} gap-5 mb-8`}>
          {items.map(it => (
            <div key={it.url} className="bg-card rounded-xl border border-[var(--border)] p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold">{it.title}</h3>
                <a href={it.url} target="_blank" rel="noopener" className="text-[10px] text-[var(--accent-strong)] hover:underline">Abrir ↗</a>
              </div>
              {it.type === 'iframe' ? (
                <iframe
                  src={it.url}
                  sandbox="allow-scripts"
                  className="w-full rounded-lg border border-[var(--border)]"
                  style={{ height: 560 }}
                />
              ) : (
                <object data={it.url} type="application/pdf" className="w-full rounded-lg border border-[var(--border)]" style={{ height: 560 }}>
                  <a href={it.url} className="text-[var(--accent-strong)] text-sm hover:underline">Descargar PDF</a>
                </object>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action panel */}
      <div className="bg-card rounded-xl border border-[var(--border)] p-6 max-w-2xl mx-auto shadow-[var(--shadow-soft)]">
        <h2 className="text-[length:var(--h2-size)] font-semibold mb-5">¿Qué hacemos con esta demo?</h2>
        <div className="space-y-4">

          {/* Approve */}
          <form method="POST" action={`/api/admin/approve/${encodeURIComponent(decoded)}`}>
            <Button type="submit" className="w-full bg-[var(--green)] hover:opacity-90" size="lg">
              ✓ Aprobar y enviar al cliente ahora
            </Button>
          </form>

          {/* Request changes */}
          <details className="border border-[oklch(0.62_0.18_290_/_0.30)] rounded-md overflow-hidden">
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[oklch(0.62_0.18_290_/_0.05)] text-sm font-medium text-[var(--purple)] list-none">
              <span>✏ Pedir cambios antes de enviar</span>
              <span className="text-xs">▼</span>
            </summary>
            <form method="POST" action={`/api/admin/request-changes/${encodeURIComponent(decoded)}`} className="px-4 pb-4 pt-2">
              <p className="text-xs text-muted-foreground mb-2">Describí qué querés que cambie. Quedará anotado para regenerar después.</p>
              <MicTextarea name="notes" placeholder="Ej: Cambiar los colores a azul, el título principal debería decir..." rows={3} />
              <Button type="submit" className="w-full mt-3" variant="secondary" size="sm">Guardar correcciones</Button>
            </form>
          </details>

          {/* Reject + regenerate */}
          <details className="border border-[oklch(0.62_0.22_27_/_0.30)] rounded-md overflow-hidden">
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[oklch(0.62_0.22_27_/_0.05)] text-sm font-medium text-[var(--red)] list-none">
              <span>✗ Rechazar y regenerar</span>
              <span className="text-xs">▼</span>
            </summary>
            <form method="POST" action={`/api/admin/reject/${encodeURIComponent(decoded)}`} className="px-4 pb-4 pt-2">
              <p className="text-xs text-muted-foreground mb-2">La demo no quedó bien. Agregá una nota y el sistema regenera automáticamente.</p>
              <MicTextarea name="notes" placeholder="Ej: Los colores no van con el rubro..." rows={2} />
              <Button type="submit" className="w-full mt-3 bg-[var(--red)] hover:opacity-90" size="sm">🔄 Rechazar y regenerar ahora</Button>
            </form>
          </details>

        </div>
      </div>
    </div>
  );
}
