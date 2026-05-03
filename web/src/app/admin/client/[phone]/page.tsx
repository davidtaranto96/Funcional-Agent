import { notFound } from 'next/navigation';
import Link from 'next/link';
import * as db from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { StageBadge, DemoStatusBadge } from '@/components/admin/StageBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { STAGES } from '@/lib/constants';
import { phoneSlug, timeAgo, escapeHtml } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ClientDetailPage({ params }: { params: Promise<{ phone: string }> }) {
  const { phone } = await params;
  const decoded = decodeURIComponent(phone);
  const conv = await db.getConversation(decoded);
  if (!conv) notFound();

  const slug = phoneSlug(decoded);
  const localDir = path.resolve(process.cwd(), '..', 'data', 'demos', slug);
  const hasLanding = fs.existsSync(path.join(localDir, 'landing.html'));
  const hasWA = fs.existsSync(path.join(localDir, 'whatsapp.html'));
  const hasPDF = fs.existsSync(path.join(localDir, 'propuesta.pdf'));

  const nombre = conv.report?.cliente?.nombre || decoded;
  const cliente = conv.report?.cliente || {};
  const proyecto = conv.report?.proyecto || {};
  const requisitos = conv.report?.requisitos || {};
  const analisis = conv.report?.analisis;

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Breadcrumb */}
      <Link href="/admin/clients" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        ← Volver al pipeline
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full grid place-items-center text-base font-semibold flex-shrink-0" style={{ background: 'var(--bg-card-2)', color: 'var(--text-1)' }}>
            {nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-[length:var(--h1-size)] font-semibold tracking-tight">{nombre}</h1>
            <div className="text-xs text-muted-foreground mt-0.5">{decoded}</div>
            <div className="flex items-center gap-2 mt-2">
              <StageBadge stage={conv.client_stage} />
              <DemoStatusBadge status={conv.demo_status} />
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          {conv.demo_status === 'pending_review' && (
            <Button asChild size="sm">
              <Link href={`/admin/review/${encodeURIComponent(decoded)}`}>Revisar demo →</Link>
            </Button>
          )}
          {conv.demo_status === 'approved' && (
            <form method="POST" action={`/api/admin/resend-demo/${encodeURIComponent(decoded)}`}>
              <Button type="submit" variant="outline" size="sm">Reenviar demo</Button>
            </form>
          )}
          {conv.report && (
            <form method="POST" action={`/api/admin/regenerate/${encodeURIComponent(decoded)}`}>
              <Button type="submit" variant="outline" size="sm">Regenerar demos</Button>
            </form>
          )}
        </div>
      </div>

      {/* Stage selector */}
      <div className="bg-card rounded-xl border border-[var(--border)] p-4 mb-5 shadow-[var(--shadow-soft)]">
        <div className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">Cambiar etapa</div>
        <form method="POST" action={`/api/admin/stage/${encodeURIComponent(decoded)}`} className="flex flex-wrap gap-1.5">
          {STAGES.map(s => (
            <button
              key={s.key}
              name="stage"
              value={s.key}
              type="submit"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
                conv.client_stage === s.key
                  ? 'bg-[var(--accent-dim)] text-foreground'
                  : 'bg-[var(--bg-inset)] text-muted-foreground hover:text-foreground hover:bg-[var(--bg-card-2)]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
              {s.label}
            </button>
          ))}
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Report + History */}
        <div className="lg:col-span-2 space-y-5">
          {conv.report ? (
            <div className="bg-card rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-[length:var(--h2-size)] font-semibold mb-3">Reporte</h2>
              {conv.report.resumen_ejecutivo && (
                <p className="text-sm text-foreground mb-4 leading-relaxed">{conv.report.resumen_ejecutivo}</p>
              )}

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                {cliente.email && <Field label="Email" value={cliente.email} />}
                {cliente.rubro && <Field label="Rubro" value={cliente.rubro} />}
                {cliente.ubicacion && <Field label="Ubicación" value={cliente.ubicacion} />}
                {cliente.nivel_tecnico && <Field label="Nivel técnico" value={cliente.nivel_tecnico} />}
                {proyecto.tipo && <Field label="Tipo de proyecto" value={proyecto.tipo} />}
                {proyecto.plataforma && <Field label="Plataforma" value={proyecto.plataforma} />}
                {proyecto.audiencia_objetivo && <Field label="Audiencia" value={proyecto.audiencia_objetivo} />}
                {proyecto.modelo_negocio && <Field label="Modelo de negocio" value={proyecto.modelo_negocio} />}
                {requisitos.plazo && <Field label="Plazo" value={requisitos.plazo} />}
                {requisitos.presupuesto && <Field label="Presupuesto" value={requisitos.presupuesto} />}
                {requisitos.urgencia && <Field label="Urgencia" value={requisitos.urgencia} />}
                {analisis?.complejidad_estimada && <Field label="Complejidad" value={analisis.complejidad_estimada} />}
                {analisis?.horas_estimadas && <Field label="Horas estimadas" value={analisis.horas_estimadas} />}
              </dl>

              {proyecto.descripcion && (
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <div className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1.5">Descripción</div>
                  <p className="text-sm text-foreground">{proyecto.descripcion}</p>
                </div>
              )}

              {(proyecto.funcionalidades || []).length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <div className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">Funcionalidades</div>
                  <ul className="space-y-1.5">
                    {(proyecto.funcionalidades || []).map((f, i) => (
                      <li key={i} className="text-sm text-foreground flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-[var(--accent)] mt-2 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-dashed border-[var(--border-strong)] p-8 text-center">
              <p className="text-sm text-muted-foreground">Sin reporte todavía. El reporte se genera automáticamente cuando el cliente confirma el resumen del agente.</p>
            </div>
          )}

          {/* Demos preview */}
          {(hasLanding || hasWA || hasPDF) && (
            <div className="bg-card rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[length:var(--h2-size)] font-semibold">Demos generados</h2>
                <Link href={`/admin/review/${encodeURIComponent(decoded)}`} className="text-xs text-[var(--accent-strong)] hover:underline">Revisar →</Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {hasLanding && <a href={`/demos/${slug}/landing.html`} target="_blank" rel="noopener" className="text-xs text-[var(--accent-strong)] hover:underline">🌐 Landing</a>}
                {hasWA && <a href={`/demos/${slug}/whatsapp.html`} target="_blank" rel="noopener" className="text-xs text-[var(--accent-strong)] hover:underline">💬 WhatsApp</a>}
                {hasPDF && <a href={`/demos/${slug}/propuesta.pdf`} target="_blank" rel="noopener" className="text-xs text-[var(--accent-strong)] hover:underline">📄 PDF</a>}
              </div>
            </div>
          )}

          {/* Conversation history */}
          <div className="bg-card rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-[length:var(--h2-size)] font-semibold mb-3">Conversación ({(conv.history || []).length} mensajes)</h2>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {(conv.history || []).slice(-30).map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                    m.role === 'user'
                      ? 'bg-[var(--accent-dim)] text-foreground'
                      : 'bg-[var(--bg-inset)] text-muted-foreground'
                  }`}>
                    <div className="text-[9px] uppercase tracking-wider opacity-60 mb-0.5">{m.role === 'user' ? 'Cliente' : 'Asistente'}</div>
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  </div>
                </div>
              ))}
              {(conv.history || []).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Sin mensajes aún.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Timeline + meta */}
        <div className="space-y-5">
          <div className="bg-card rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-[length:var(--h2-size)] font-semibold mb-3">Timeline</h2>
            <ol className="space-y-3">
              {(conv.timeline || []).slice(-10).reverse().map((e, i) => (
                <li key={i} className="text-xs">
                  <div className="flex items-baseline gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-foreground">{e.event.replace(/_/g, ' ')}</div>
                      {e.note && <div className="text-muted-foreground text-[10px] mt-0.5">{e.note}</div>}
                      <div className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(e.date)}</div>
                    </div>
                  </div>
                </li>
              ))}
              {(conv.timeline || []).length === 0 && (
                <p className="text-xs text-muted-foreground">Sin eventos.</p>
              )}
            </ol>
          </div>

          {conv.notes && (
            <div className="bg-card rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-[length:var(--h2-size)] font-semibold mb-2">Notas</h2>
              <p className="text-xs text-foreground whitespace-pre-wrap">{conv.notes}</p>
            </div>
          )}

          {conv.demo_notes && (
            <div className="bg-[oklch(0.62_0.18_290_/_0.10)] border border-[oklch(0.62_0.18_290_/_0.30)] rounded-xl p-5">
              <h2 className="text-[length:var(--h2-size)] font-semibold text-[var(--purple)] mb-2">✏ Correcciones pedidas</h2>
              <p className="text-xs text-foreground whitespace-pre-wrap">{conv.demo_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | boolean | undefined }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground mt-0.5">{String(value)}</dd>
    </div>
  );
}
