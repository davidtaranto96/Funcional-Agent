import { notFound } from 'next/navigation';
import Link from 'next/link';
import * as db from '@/lib/db';
import fs from 'fs';
import path from 'path';
import {
  ArrowLeft, MessageCircle, ExternalLink, FileText, Globe, RefreshCcw, Send, Sparkles,
  Eye, MapPin, Briefcase, Mail, Calendar,
} from 'lucide-react';
import { STAGES } from '@/lib/constants';
import { phoneSlug, timeAgo } from '@/lib/utils';
import { AnalyzeConversation } from './AnalyzeConversation';
import { ManualControl } from './ManualControl';
import { LeadScoreCard } from './LeadScoreCard';

export const dynamic = 'force-dynamic';

const LEAD_SCORE_META: Record<string, { label: string; color: string }> = {
  hot:  { label: 'HOT',  color: 'oklch(0.62 0.22 27)'  },
  warm: { label: 'WARM', color: 'oklch(0.74 0.16 75)'  },
  cold: { label: 'COLD', color: 'oklch(0.62 0.16 200)' },
};

const DEMO_STATUS_META: Record<string, { label: string; color: string }> = {
  none:           { label: 'Sin demo',         color: 'oklch(0.5 0.05 250)' },
  generating:     { label: 'Generando',        color: 'oklch(0.62 0.18 250)' },
  pending_review: { label: 'Pendiente revisar', color: 'oklch(0.74 0.16 75)' },
  approved:       { label: 'Aprobada',         color: 'oklch(0.62 0.16 160)' },
  rejected:       { label: 'Rechazada',        color: 'oklch(0.62 0.22 27)' },
  sent:           { label: 'Enviada',          color: 'oklch(0.62 0.18 290)' },
};

export default async function ClientDetailPage({ params }: { params: Promise<{ phone: string }> }) {
  const { phone } = await params;
  const decoded = decodeURIComponent(phone);
  const conv = await db.getConversation(decoded);
  if (!conv) notFound();

  const slug = phoneSlug(decoded);
  const localDir = path.join(process.env.DATA_DIR || '/app/data', 'demos', slug);
  const hasLanding = fs.existsSync(path.join(localDir, 'landing.html'));
  const hasWA = fs.existsSync(path.join(localDir, 'whatsapp.html'));
  const hasPDF = fs.existsSync(path.join(localDir, 'propuesta.pdf'));

  const nombre = conv.report?.cliente?.nombre || decoded;
  const cliente = conv.report?.cliente || {};
  const proyecto = conv.report?.proyecto || {};
  const requisitos = conv.report?.requisitos || {};
  const analisis = conv.report?.analisis;

  const stage = STAGES.find(s => s.key === conv.client_stage);
  const demoMeta = DEMO_STATUS_META[conv.demo_status] || DEMO_STATUS_META.none;
  const waUrl = `https://wa.me/${decoded.replace(/\D/g, '')}`;

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Breadcrumb */}
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="w-3 h-3" /> Volver al pipeline
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className="w-12 h-12 rounded-full grid place-items-center text-[16px] font-bold text-white flex-shrink-0"
            style={{
              background: stage?.dot || 'var(--accent)',
              boxShadow: `0 4px 14px color-mix(in oklch, ${stage?.dot || 'var(--accent)'} 30%, transparent)`,
            }}
          >
            {nombre.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold tracking-tight text-foreground leading-tight">{nombre}</h1>
            <div className="mono text-[12px] text-muted-foreground mt-0.5">{decoded}</div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {stage && (
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider rounded px-2 py-1"
                  style={{
                    background: `color-mix(in oklch, ${stage.dot} 14%, transparent)`,
                    color: stage.dot,
                  }}
                >
                  <span className="w-1 h-1 rounded-full" style={{ background: stage.dot }} />
                  {stage.label}
                </span>
              )}
              <span
                className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider rounded px-2 py-1"
                style={{
                  background: `color-mix(in oklch, ${demoMeta.color} 14%, transparent)`,
                  color: demoMeta.color,
                }}
              >
                Demo: {demoMeta.label}
              </span>
              {conv.lead_score && (
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider rounded px-2 py-1"
                  style={{
                    background: `color-mix(in oklch, ${LEAD_SCORE_META[conv.lead_score].color} 14%, transparent)`,
                    color: LEAD_SCORE_META[conv.lead_score].color,
                  }}
                  title={conv.lead_score_reason || 'Sin razón guardada'}
                >
                  <span className="w-1 h-1 rounded-full" style={{ background: LEAD_SCORE_META[conv.lead_score].color }} />
                  Lead {LEAD_SCORE_META[conv.lead_score].label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[oklch(0.62_0.16_160_/_0.13)] text-[var(--green)] text-[12px] font-medium hover:bg-[oklch(0.62_0.16_160_/_0.20)] transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
          {conv.demo_status === 'pending_review' && (
            <Link
              href={`/admin/review/${encodeURIComponent(decoded)}`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--amber)] text-[var(--bg)] text-[12px] font-semibold hover:brightness-110 transition-all"
            >
              <Eye className="w-3.5 h-3.5" /> Revisar demo
            </Link>
          )}
          {conv.demo_status === 'approved' && (
            <form method="POST" action={`/api/admin/resend-demo/${encodeURIComponent(decoded)}`}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--bg-card-2)] border border-[var(--border)] text-[12px] font-medium text-foreground hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> Reenviar demo
              </button>
            </form>
          )}
          {conv.report && (
            <form method="POST" action={`/api/admin/regenerate/${encodeURIComponent(decoded)}`}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--bg-card-2)] border border-[var(--border)] text-[12px] font-medium text-foreground hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Regenerar
              </button>
            </form>
          )}
          <AnalyzeConversation phone={decoded} hasHistory={(conv.history || []).length > 0} />
        </div>
      </div>

      {/* Stage selector */}
      <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] p-3.5 mb-5 shadow-[var(--shadow-soft)]">
        <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground mb-2">Cambiar etapa</div>
        <form method="POST" action={`/api/admin/stage/${encodeURIComponent(decoded)}`} className="flex flex-wrap gap-1.5">
          {STAGES.map(s => {
            const active = conv.client_stage === s.key;
            return (
              <button
                key={s.key}
                name="stage"
                value={s.key}
                type="submit"
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
                  active
                    ? 'text-foreground border'
                    : 'text-muted-foreground hover:text-foreground bg-[var(--bg-inset)] border border-transparent'
                }`}
                style={
                  active
                    ? {
                        background: `color-mix(in oklch, ${s.dot} 14%, transparent)`,
                        color: s.dot,
                        borderColor: `color-mix(in oklch, ${s.dot} 30%, transparent)`,
                      }
                    : undefined
                }
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                {s.label}
              </button>
            );
          })}
        </form>
      </div>

      {/* Demos preview banner si hay archivos */}
      {(hasLanding || hasWA || hasPDF) && (
        <div
          className="bg-card rounded-[var(--r-lg)] border p-4 mb-5 shadow-[var(--shadow-soft)]"
          style={{ borderColor: 'color-mix(in oklch, var(--purple) 25%, var(--border))' }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div
                className="grid place-items-center w-8 h-8 rounded-md"
                style={{ background: 'oklch(0.62 0.18 290 / 0.13)', color: 'var(--purple)' }}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-foreground">Demos generados</div>
                <div className="text-[11px] text-muted-foreground">Landing page, mockup WhatsApp y propuesta PDF</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {hasLanding && (
                <a
                  href={`/demos/${slug}/landing.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[var(--bg-inset)] border border-[var(--border)] text-[11px] font-medium text-foreground hover:bg-[var(--bg-card-2)] transition-colors"
                >
                  <Globe className="w-3 h-3" /> Landing <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                </a>
              )}
              {hasWA && (
                <a
                  href={`/demos/${slug}/whatsapp.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[var(--bg-inset)] border border-[var(--border)] text-[11px] font-medium text-foreground hover:bg-[var(--bg-card-2)] transition-colors"
                >
                  <MessageCircle className="w-3 h-3" /> WhatsApp <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                </a>
              )}
              {hasPDF && (
                <a
                  href={`/demos/${slug}/propuesta.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[var(--bg-inset)] border border-[var(--border)] text-[11px] font-medium text-foreground hover:bg-[var(--bg-card-2)] transition-colors"
                >
                  <FileText className="w-3 h-3" /> PDF <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                </a>
              )}
              <Link
                href={`/admin/review/${encodeURIComponent(decoded)}`}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[var(--accent)] text-white text-[11px] font-semibold hover:brightness-110 transition-all"
                style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
              >
                Sandbox →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Reporte + Conversación */}
        <div className="lg:col-span-2 space-y-4">
          {conv.report ? (
            <Card title="Reporte del agente">
              {conv.report.resumen_ejecutivo && (
                <p className="text-[13px] text-foreground leading-relaxed mb-4">
                  {conv.report.resumen_ejecutivo}
                </p>
              )}

              {/* Datos de contacto inline */}
              <div className="flex items-center gap-3 mb-4 flex-wrap text-[11px]">
                {cliente.email && (
                  <a href={`mailto:${cliente.email}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-[var(--accent-strong)] transition-colors">
                    <Mail className="w-3 h-3" /> {cliente.email}
                  </a>
                )}
                {cliente.ubicacion && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <MapPin className="w-3 h-3" /> {cliente.ubicacion}
                  </span>
                )}
                {cliente.rubro && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Briefcase className="w-3 h-3" /> {cliente.rubro}
                  </span>
                )}
              </div>

              {/* Datos en grid */}
              <DataSection title="Proyecto" items={[
                { label: 'Tipo',       value: proyecto.tipo },
                { label: 'Plataforma', value: proyecto.plataforma },
                { label: 'Audiencia',  value: proyecto.audiencia_objetivo },
                { label: 'Modelo',     value: proyecto.modelo_negocio },
              ]} />

              {proyecto.descripcion && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <Label>Descripción</Label>
                  <p className="text-[12px] text-foreground mt-1 leading-relaxed">{proyecto.descripcion}</p>
                </div>
              )}

              {(proyecto.funcionalidades || []).length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <Label>Funcionalidades</Label>
                  <ul className="space-y-1 mt-2">
                    {(proyecto.funcionalidades || []).map((f, i) => (
                      <li key={i} className="text-[12px] text-foreground flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-[var(--accent)] mt-2 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(requisitos.plazo || requisitos.presupuesto || requisitos.urgencia) && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <DataSection title="Requisitos" items={[
                    { label: 'Plazo',       value: requisitos.plazo },
                    { label: 'Presupuesto', value: requisitos.presupuesto },
                    { label: 'Urgencia',    value: requisitos.urgencia },
                    { label: 'Stack',       value: requisitos.stack_sugerido },
                  ]} />
                </div>
              )}

              {analisis && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <DataSection title="Análisis técnico" items={[
                    { label: 'Complejidad', value: analisis.complejidad_estimada },
                    { label: 'Horas est.',  value: analisis.horas_estimadas, mono: true },
                  ]} />
                  {analisis.mvp_sugerido && (
                    <div className="mt-2">
                      <Label>MVP sugerido</Label>
                      <p className="text-[12px] text-foreground mt-1">{analisis.mvp_sugerido}</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ) : (
            <Card title="Reporte">
              <p className="text-[12px] text-muted-foreground py-4 text-center">
                Sin reporte todavía. Se genera automáticamente cuando el cliente confirma el resumen del agente.
              </p>
            </Card>
          )}

          {/* Lead score card */}
          <LeadScoreCard
            phone={decoded}
            score={conv.lead_score}
            reason={conv.lead_score_reason}
            scoredAt={conv.lead_score_at}
          />

          {/* Manual control: pausar bot + caja para responder desde el admin */}
          <ManualControl phone={decoded} initialPaused={conv.bot_paused === 1} />

          {/* Conversación */}
          <Card title={`Conversación (${(conv.history || []).length} mensajes)`}>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 -mx-1 px-1">
              {(conv.history || []).slice(-30).map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-[12px] ${
                      m.role === 'user'
                        ? 'bg-[var(--accent-dim)] text-foreground'
                        : 'bg-[var(--bg-inset)] text-muted-foreground'
                    }`}
                  >
                    <div className="mono text-[9px] uppercase tracking-wider opacity-60 mb-1">
                      {m.role === 'user' ? 'Cliente' : 'Asistente'}
                    </div>
                    <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>
                  </div>
                </div>
              ))}
              {(conv.history || []).length === 0 && (
                <p className="text-[12px] text-muted-foreground text-center py-8">Sin mensajes aún.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Right: Timeline + Notas */}
        <div className="space-y-4">
          <Card title="Timeline" icon={<Calendar className="w-3.5 h-3.5" />}>
            {(conv.timeline || []).length === 0 ? (
              <p className="text-[12px] text-muted-foreground py-2">Sin eventos.</p>
            ) : (
              <ol className="space-y-3 relative">
                <span className="absolute left-1 top-1.5 bottom-1.5 w-px bg-[var(--border)]" aria-hidden />
                {(conv.timeline || []).slice(-10).reverse().map((e, i) => (
                  <li key={i} className="relative pl-5">
                    <span
                      className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-[var(--accent)]"
                      style={{ boxShadow: '0 0 6px var(--accent-glow)' }}
                    />
                    <div className="text-[12px] text-foreground capitalize leading-tight">
                      {e.event.replace(/_/g, ' ')}
                    </div>
                    {e.note && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">{e.note}</div>
                    )}
                    <div className="mono text-[10px] text-muted-foreground mt-0.5">{timeAgo(e.date)}</div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {conv.notes && (
            <Card title="Notas internas">
              <p className="text-[12px] text-foreground whitespace-pre-wrap leading-relaxed">{conv.notes}</p>
            </Card>
          )}

          {conv.demo_notes && (
            <div
              className="rounded-[var(--r-lg)] border p-4"
              style={{
                background: 'oklch(0.62 0.18 290 / 0.08)',
                borderColor: 'oklch(0.62 0.18 290 / 0.30)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="grid place-items-center w-5 h-5 rounded bg-[oklch(0.62_0.18_290_/_0.20)] text-[var(--purple)]">
                  <Sparkles className="w-3 h-3" />
                </span>
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--purple)]">
                  Correcciones pedidas
                </h3>
              </div>
              <p className="text-[12px] text-foreground whitespace-pre-wrap leading-relaxed">
                {conv.demo_notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-[var(--border)]">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </span>
  );
}

function DataSection({ title, items }: { title?: string; items: Array<{ label: string; value: string | undefined; mono?: boolean }> }) {
  const visible = items.filter(it => it.value);
  if (visible.length === 0) return null;
  return (
    <div>
      {title && <Label>{title}</Label>}
      <div className={`grid grid-cols-2 gap-x-4 gap-y-2 ${title ? 'mt-2' : ''}`}>
        {visible.map(it => (
          <div key={it.label}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{it.label}</div>
            <div className={`text-[12px] text-foreground ${it.mono ? 'mono' : ''}`}>{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
