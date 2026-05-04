import { notFound } from 'next/navigation';
import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import * as db from '@/lib/db';
import {
  ArrowLeft, ExternalLink, Sparkles, Check, X, Edit3,
  Globe, MessageCircle, FileText, AlertTriangle, ChevronDown,
} from 'lucide-react';
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
  const localDir = path.join(process.env.DATA_DIR || '/app/data', 'demos', slug);
  const hasLanding = fs.existsSync(path.join(localDir, 'landing.html'));
  const hasWA = fs.existsSync(path.join(localDir, 'whatsapp.html'));
  const hasPDF = fs.existsSync(path.join(localDir, 'propuesta.pdf'));

  let versions: VersionEntry[] = [];
  try {
    const vf = path.join(localDir, 'versions.json');
    if (fs.existsSync(vf)) versions = JSON.parse(fs.readFileSync(vf, 'utf-8'));
  } catch {}

  const nombre = conv.report?.cliente?.nombre || decoded;

  const items: Array<{ title: string; url: string; type: 'iframe' | 'pdf'; Icon: React.ComponentType<{ className?: string }>; color: string }> = [];
  if (hasLanding) items.push({ title: 'Landing HTML',     url: `/demos/${slug}/landing.html`,  type: 'iframe', Icon: Globe,         color: 'oklch(0.62 0.20 250)' });
  if (hasWA)      items.push({ title: 'Mockup WhatsApp',  url: `/demos/${slug}/whatsapp.html`, type: 'iframe', Icon: MessageCircle, color: 'oklch(0.62 0.16 160)' });
  if (hasPDF)     items.push({ title: 'Mini-propuesta PDF', url: `/demos/${slug}/propuesta.pdf`, type: 'pdf',  Icon: FileText,      color: 'oklch(0.62 0.22 27)' });

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <Link
        href={`/admin/client/${encodeURIComponent(decoded)}`}
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="w-3 h-3" /> {nombre}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3.5 mb-5">
        <div
          className="grid place-items-center w-10 h-10 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] flex-shrink-0"
          style={{ boxShadow: '0 4px 14px var(--accent-glow)' }}
        >
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Sandbox de revisión</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            <span className="text-foreground font-medium">{nombre}</span>
            {' · '}<span className="mono">{decoded}</span>
            {' · '}{items.length} archivo{items.length !== 1 ? 's' : ''} listo{items.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Correcciones previas */}
      {conv.demo_notes && (
        <div
          className="rounded-[var(--r-lg)] border p-4 mb-5"
          style={{
            background: 'oklch(0.62 0.18 290 / 0.08)',
            borderColor: 'oklch(0.62 0.18 290 / 0.30)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="grid place-items-center w-5 h-5 rounded bg-[oklch(0.62_0.18_290_/_0.20)] text-[var(--purple)]">
              <Edit3 className="w-3 h-3" />
            </span>
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--purple)]">
              Correcciones pedidas antes
            </h3>
          </div>
          <p className="text-[12px] text-foreground whitespace-pre-line leading-relaxed">{conv.demo_notes}</p>
        </div>
      )}

      {/* Versiones anteriores */}
      {versions.length > 0 && (
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] mb-5 shadow-[var(--shadow-soft)] overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-[var(--border)]">
            <h2 className="text-[13px] font-semibold text-foreground">Versiones anteriores</h2>
            <span className="mono text-[10px] text-muted-foreground">{versions.length}</span>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {versions.map(v => {
              const d = new Date(v.date);
              const dateStr = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
              return (
                <li key={v.version} className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-inset)] transition-colors gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="mono text-[12px] font-bold text-[var(--accent-strong)] flex-shrink-0">v{v.version}</span>
                    <span className="mono text-[10px] text-muted-foreground flex-shrink-0">{dateStr}</span>
                    {v.notes && (
                      <span className="text-[11px] text-[var(--purple)] italic truncate">{v.notes}</span>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {fs.existsSync(path.join(localDir, `v${v.version}`, 'landing.html')) && (
                      <a
                        href={`/demos/${slug}/v${v.version}/landing.html`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] px-2 py-0.5 bg-[var(--bg-inset)] border border-[var(--border)] rounded text-muted-foreground hover:text-foreground hover:bg-[var(--bg-card-2)] transition-colors"
                      >
                        Landing
                      </a>
                    )}
                    {fs.existsSync(path.join(localDir, `v${v.version}`, 'whatsapp.html')) && (
                      <a
                        href={`/demos/${slug}/v${v.version}/whatsapp.html`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] px-2 py-0.5 bg-[var(--bg-inset)] border border-[var(--border)] rounded text-muted-foreground hover:text-foreground hover:bg-[var(--bg-card-2)] transition-colors"
                      >
                        WA
                      </a>
                    )}
                    {fs.existsSync(path.join(localDir, `v${v.version}`, 'propuesta.pdf')) && (
                      <a
                        href={`/demos/${slug}/v${v.version}/propuesta.pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] px-2 py-0.5 bg-[var(--bg-inset)] border border-[var(--border)] rounded text-muted-foreground hover:text-foreground hover:bg-[var(--bg-card-2)] transition-colors"
                      >
                        PDF
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 ? (
        <div
          className="rounded-[var(--r-lg)] border p-5 mb-6 flex items-start gap-3"
          style={{
            background: 'oklch(0.74 0.16 75 / 0.08)',
            borderColor: 'oklch(0.74 0.16 75 / 0.30)',
          }}
        >
          <AlertTriangle className="w-5 h-5 text-[var(--amber)] flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-[13px] font-semibold text-foreground mb-1">No hay archivos generados</div>
            <p className="text-[12px] text-muted-foreground">
              Aún no se generaron archivos de demo para este cliente. Esperá a que el agente termine la conversación o regenerá manualmente desde la ficha.
            </p>
          </div>
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${items.length > 1 ? `lg:grid-cols-${Math.min(items.length, 3)}` : ''} gap-4 mb-8`}>
          {items.map(it => (
            <div key={it.url} className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span
                    className="grid place-items-center w-6 h-6 rounded"
                    style={{ background: `color-mix(in oklch, ${it.color} 14%, transparent)`, color: it.color }}
                  >
                    <it.Icon className="w-3 h-3" />
                  </span>
                  <h3 className="text-[12px] font-semibold text-foreground">{it.title}</h3>
                </div>
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-[var(--accent-strong)] hover:underline"
                >
                  Abrir <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              {it.type === 'iframe' ? (
                <iframe
                  src={it.url}
                  sandbox="allow-scripts"
                  className="w-full block bg-white"
                  style={{ height: 580 }}
                />
              ) : (
                <object data={it.url} type="application/pdf" className="w-full block" style={{ height: 580 }}>
                  <a href={it.url} className="text-[var(--accent-strong)] text-sm hover:underline block p-4">
                    Descargar PDF
                  </a>
                </object>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action panel */}
      <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] max-w-[640px] mx-auto shadow-[var(--shadow-soft)] overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <h2 className="text-[14px] font-semibold text-foreground">¿Qué hacemos con esta demo?</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">Aprobá y enviá, pedí cambios o rechazá y regenerá</p>
        </div>

        <div className="p-5 space-y-3">
          {/* Approve — primary action */}
          <form method="POST" action={`/api/admin/approve/${encodeURIComponent(decoded)}`}>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-md bg-[var(--green)] text-white text-[13px] font-bold transition-all hover:brightness-110"
              style={{ boxShadow: '0 4px 14px color-mix(in oklch, var(--green) 30%, transparent)' }}
            >
              <Check className="w-4 h-4" strokeWidth={3} /> Aprobar y enviar al cliente
            </button>
          </form>

          {/* Request changes */}
          <details className="border border-[oklch(0.62_0.18_290_/_0.30)] rounded-md overflow-hidden group">
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[oklch(0.62_0.18_290_/_0.05)] text-[13px] font-medium text-[var(--purple)] list-none">
              <span className="flex items-center gap-2">
                <Edit3 className="w-3.5 h-3.5" /> Pedir cambios antes de enviar
              </span>
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <form method="POST" action={`/api/admin/request-changes/${encodeURIComponent(decoded)}`} className="px-4 pb-4 pt-2">
              <p className="text-[11px] text-muted-foreground mb-2">
                Describí qué querés que cambie. Quedará anotado para la próxima regeneración.
              </p>
              <MicTextarea
                name="notes"
                placeholder="Ej: Cambiar los colores a azul, el título debería decir..."
                rows={3}
              />
              <button
                type="submit"
                className="w-full mt-3 inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-[oklch(0.62_0.18_290_/_0.13)] text-[var(--purple)] text-[12px] font-semibold hover:bg-[oklch(0.62_0.18_290_/_0.20)] transition-colors"
              >
                Guardar correcciones
              </button>
            </form>
          </details>

          {/* Reject + regenerate */}
          <details className="border border-[oklch(0.62_0.22_27_/_0.30)] rounded-md overflow-hidden group">
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[oklch(0.62_0.22_27_/_0.05)] text-[13px] font-medium text-[var(--red)] list-none">
              <span className="flex items-center gap-2">
                <X className="w-3.5 h-3.5" strokeWidth={3} /> Rechazar y regenerar
              </span>
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <form method="POST" action={`/api/admin/reject/${encodeURIComponent(decoded)}`} className="px-4 pb-4 pt-2">
              <p className="text-[11px] text-muted-foreground mb-2">
                La demo no quedó bien. Agregá una nota y el sistema regenera automáticamente.
              </p>
              <MicTextarea
                name="notes"
                placeholder="Ej: Los colores no van con el rubro, el copy es muy formal..."
                rows={2}
              />
              <button
                type="submit"
                className="w-full mt-3 inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-[var(--red)] text-white text-[12px] font-semibold hover:brightness-110 transition-all"
              >
                Rechazar y regenerar
              </button>
            </form>
          </details>
        </div>
      </div>
    </div>
  );
}
