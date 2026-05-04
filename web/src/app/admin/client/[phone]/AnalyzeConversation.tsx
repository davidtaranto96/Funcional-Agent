'use client';

import { useState } from 'react';
import { Sparkles, X, AlertTriangle, CheckCircle2, Lightbulb, Target, Loader2 } from 'lucide-react';
import { showToast } from '@/components/ui/toast';

interface SpecificMoment {
  messageIdx: number;
  role: 'user' | 'assistant';
  issue: string;
  suggestion: string;
}
interface PromptSuggestion {
  issue: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}
interface Analysis {
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  missedOpportunities: string[];
  specificMoments: SpecificMoment[];
  promptSuggestions: PromptSuggestion[];
}
interface AnalyzeResponse {
  ok: true;
  analysis: Analysis;
  meta: { messageCount: number; model: string; analyzedAt: string; clientName: string };
}

interface Props {
  phone: string;
  hasHistory: boolean;
}

const PRIO_COLOR: Record<string, string> = {
  high: 'oklch(0.62 0.22 27)',
  medium: 'oklch(0.74 0.16 75)',
  low: 'oklch(0.5 0.05 250)',
};

export function AnalyzeConversation({ phone, hasHistory }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalyzeResponse | null>(null);

  async function run() {
    setOpen(true);
    if (data) return; // ya tengo resultado, mostrar cache
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(phone)}/analyze`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        showToast(json?.error || 'No pude analizar', 'err');
        setOpen(false);
        return;
      }
      setData(json);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error de red', 'err');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={!hasHistory || loading}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[12px] font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: 'linear-gradient(135deg, oklch(0.62 0.18 290), oklch(0.62 0.20 250))',
          boxShadow: '0 2px 10px oklch(0.62 0.18 290 / 0.30)',
        }}
        title={hasHistory ? 'Pedirle a Claude que analice esta conversacion para mejorar al bot' : 'Sin historial para analizar'}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        {loading ? 'Analizando…' : 'Analizar conversación'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto pd-fade-in"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-card border border-[var(--border-strong)] rounded-[var(--r-lg)] shadow-[var(--shadow-elev)] w-[760px] max-w-full my-8"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <div
                  className="grid place-items-center w-8 h-8 rounded-md"
                  style={{ background: 'oklch(0.62 0.18 290 / 0.13)', color: 'var(--purple)' }}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[14px] font-semibold text-foreground">Análisis de conversación</h2>
                  <p className="text-[11px] text-muted-foreground">
                    {data ? `${data.meta.messageCount} mensajes · ${data.meta.model}` : 'Procesando…'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid place-items-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-[var(--bg-inset)] transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
              {loading && (
                <div className="py-12 text-center">
                  <Loader2 className="w-8 h-8 mx-auto text-[var(--purple)] animate-spin mb-3" />
                  <p className="text-[13px] text-muted-foreground">Claude esta leyendo la conversación…</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Suele tardar 5-15 segundos</p>
                </div>
              )}

              {data && (
                <>
                  {/* Score + summary */}
                  <div className="flex items-start gap-4 p-4 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-inset)]">
                    <div
                      className="grid place-items-center w-16 h-16 rounded-full flex-shrink-0 text-[24px] font-bold mono text-white"
                      style={{
                        background: scoreColor(data.analysis.score),
                        boxShadow: `0 4px 14px color-mix(in oklch, ${scoreColor(data.analysis.score)} 30%, transparent)`,
                      }}
                    >
                      {data.analysis.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Resumen</div>
                      <p className="text-[13px] text-foreground leading-relaxed">{data.analysis.summary}</p>
                    </div>
                  </div>

                  {/* Strengths */}
                  {data.analysis.strengths?.length > 0 && (
                    <Section
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      title="Lo que salió bien"
                      color="oklch(0.62 0.16 160)"
                    >
                      <ul className="space-y-1.5">
                        {data.analysis.strengths.map((s, i) => (
                          <Bullet key={i} color="oklch(0.62 0.16 160)">{s}</Bullet>
                        ))}
                      </ul>
                    </Section>
                  )}

                  {/* Weaknesses */}
                  {data.analysis.weaknesses?.length > 0 && (
                    <Section
                      icon={<AlertTriangle className="w-3.5 h-3.5" />}
                      title="Lo que se pudo mejorar"
                      color="oklch(0.74 0.16 75)"
                    >
                      <ul className="space-y-1.5">
                        {data.analysis.weaknesses.map((w, i) => (
                          <Bullet key={i} color="oklch(0.74 0.16 75)">{w}</Bullet>
                        ))}
                      </ul>
                    </Section>
                  )}

                  {/* Missed opportunities */}
                  {data.analysis.missedOpportunities?.length > 0 && (
                    <Section
                      icon={<Target className="w-3.5 h-3.5" />}
                      title="Oportunidades perdidas"
                      color="oklch(0.62 0.22 27)"
                    >
                      <ul className="space-y-1.5">
                        {data.analysis.missedOpportunities.map((m, i) => (
                          <Bullet key={i} color="oklch(0.62 0.22 27)">{m}</Bullet>
                        ))}
                      </ul>
                    </Section>
                  )}

                  {/* Specific moments */}
                  {data.analysis.specificMoments?.length > 0 && (
                    <Section
                      icon={<Sparkles className="w-3.5 h-3.5" />}
                      title="Momentos puntuales para revisar"
                      color="oklch(0.62 0.18 250)"
                    >
                      <div className="space-y-3">
                        {data.analysis.specificMoments.map((m, i) => (
                          <div key={i} className="rounded-[var(--r-lg)] border border-[var(--border)] p-3 bg-[var(--bg-inset)]">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-card text-muted-foreground">
                                msg #{m.messageIdx}
                              </span>
                              <span
                                className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{
                                  background: m.role === 'assistant' ? 'oklch(0.62 0.18 250 / 0.13)' : 'oklch(0.62 0.16 160 / 0.13)',
                                  color: m.role === 'assistant' ? 'oklch(0.62 0.18 250)' : 'oklch(0.62 0.16 160)',
                                }}
                              >
                                {m.role}
                              </span>
                            </div>
                            <p className="text-[12px] text-foreground mb-2"><strong>Problema:</strong> {m.issue}</p>
                            <p className="text-[12px] text-muted-foreground"><strong>Sugerencia:</strong> {m.suggestion}</p>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Prompt suggestions */}
                  {data.analysis.promptSuggestions?.length > 0 && (
                    <Section
                      icon={<Lightbulb className="w-3.5 h-3.5" />}
                      title="Cambios sugeridos al system prompt"
                      color="var(--purple)"
                    >
                      <div className="space-y-3">
                        {data.analysis.promptSuggestions
                          .sort((a, b) => prioOrder(a.priority) - prioOrder(b.priority))
                          .map((p, i) => (
                            <div
                              key={i}
                              className="rounded-[var(--r-lg)] border p-3"
                              style={{
                                borderColor: `color-mix(in oklch, ${PRIO_COLOR[p.priority]} 30%, var(--border))`,
                                background: `color-mix(in oklch, ${PRIO_COLOR[p.priority]} 4%, var(--bg-inset))`,
                              }}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span
                                  className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                                  style={{ background: PRIO_COLOR[p.priority] }}
                                >
                                  {p.priority}
                                </span>
                                <span className="text-[12px] font-semibold text-foreground">{p.issue}</span>
                              </div>
                              <p className="text-[12px] text-muted-foreground whitespace-pre-wrap leading-relaxed">{p.suggestion}</p>
                            </div>
                          ))}
                      </div>
                    </Section>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {data && (
              <div className="flex items-center justify-between p-3 border-t border-[var(--border)] bg-[var(--bg-inset)] rounded-b-[var(--r-lg)]">
                <p className="text-[10px] text-muted-foreground italic">
                  Análisis generado por {data.meta.model}. Aplicá los cambios manualmente al system prompt en lib/bot/agent.ts.
                </p>
                <button
                  type="button"
                  onClick={() => { setData(null); run(); }}
                  className="text-[11px] text-[var(--accent-strong)] hover:underline"
                >
                  Re-analizar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Section({ icon, title, color, children }: {
  icon: React.ReactNode; title: string; color: string; children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className="grid place-items-center w-5 h-5 rounded"
          style={{ background: `color-mix(in oklch, ${color} 14%, transparent)`, color }}
        >
          {icon}
        </span>
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color }}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Bullet({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <li className="text-[12.5px] text-foreground flex items-start gap-2 leading-relaxed">
      <span className="w-1 h-1 rounded-full mt-2 flex-shrink-0" style={{ background: color }} />
      <span>{children}</span>
    </li>
  );
}

function scoreColor(score: number): string {
  if (score >= 8) return 'oklch(0.62 0.16 160)'; // green
  if (score >= 6) return 'oklch(0.74 0.16 75)';  // amber
  if (score >= 4) return 'oklch(0.62 0.22 27)';  // red
  return 'oklch(0.5 0.05 250)';                   // gray
}

function prioOrder(p: string): number {
  return p === 'high' ? 0 : p === 'medium' ? 1 : 2;
}
