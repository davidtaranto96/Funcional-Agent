'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Snowflake, Thermometer, RefreshCw, Loader2 } from 'lucide-react';
import { showToast } from '@/components/ui/toast';

interface Props {
  phone: string;
  score: string;        // 'hot' | 'warm' | 'cold' | ''
  reason: string;
  scoredAt: string;     // ISO o ''
}

const META: Record<string, { label: string; color: string; Icon: React.ComponentType<{ className?: string }>; description: string }> = {
  hot:  { label: 'HOT',  color: 'oklch(0.62 0.22 27)',  Icon: Flame,       description: 'Lead caliente — atendelo ya' },
  warm: { label: 'WARM', color: 'oklch(0.74 0.16 75)',  Icon: Thermometer, description: 'Lead tibio — vale la pena seguirlo' },
  cold: { label: 'COLD', color: 'oklch(0.62 0.16 200)', Icon: Snowflake,   description: 'Lead frío — bajo prioridad' },
};

export function LeadScoreCard({ phone, score, reason, scoredAt }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function rescore() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(phone)}/score`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data?.error || 'No pude scorear', 'err');
        return;
      }
      showToast(`Lead clasificado como ${data.score.toUpperCase()}`, 'ok');
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error', 'err');
    } finally {
      setBusy(false);
    }
  }

  const meta = score ? META[score] : null;

  if (!meta) {
    return (
      <div className="bg-card rounded-[var(--r-lg)] border border-dashed border-[var(--border-strong)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-0.5">Lead score</h3>
            <p className="text-[11px] text-muted-foreground">Sin clasificar todavía</p>
          </div>
          <button
            type="button"
            onClick={rescore}
            disabled={busy}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-white text-[11px] font-semibold hover:brightness-110 transition-all disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Calificar ahora
          </button>
        </div>
      </div>
    );
  }

  const Icon = meta.Icon;
  const dateLabel = scoredAt ? new Date(scoredAt + (scoredAt.includes('T') ? '' : ' UTC')).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div
      className="bg-card rounded-[var(--r-lg)] border p-4"
      style={{ borderColor: `color-mix(in oklch, ${meta.color} 35%, var(--border))` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid place-items-center w-10 h-10 rounded-md flex-shrink-0"
          style={{ background: `color-mix(in oklch, ${meta.color} 14%, transparent)`, color: meta.color }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span
                className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white"
                style={{ background: meta.color }}
              >
                {meta.label}
              </span>
              <span className="text-[11px] text-muted-foreground">{meta.description}</span>
            </div>
            <button
              type="button"
              onClick={rescore}
              disabled={busy}
              className="text-[10px] text-[var(--accent-strong)] hover:underline flex items-center gap-1 disabled:opacity-50"
              title="Re-evaluar con la conversación actual"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Re-scorear
            </button>
          </div>
          {reason && (
            <p className="text-[12.5px] text-foreground leading-relaxed mt-1">
              {reason}
            </p>
          )}
          {dateLabel && (
            <p className="mono text-[10px] text-muted-foreground mt-1.5">Calificado {dateLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}
