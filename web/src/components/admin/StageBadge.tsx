import { STAGES, type StageKey } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  const def = STAGES.find(s => s.key === stage as StageKey) || STAGES[0];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs', className)}
      style={{ background: 'var(--bg-card-2)', color: 'var(--text-2)' }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: def.dot, boxShadow: `0 0 6px ${def.dot}` }} />
      {def.label}
    </span>
  );
}

export function DemoStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    none: { label: '—', bg: 'var(--bg-card-2)', color: 'var(--text-3)' },
    generating: { label: 'Generando', bg: 'oklch(0.62 0.18 290 / 0.13)', color: 'var(--purple)' },
    pending_review: { label: 'Pendiente', bg: 'oklch(0.74 0.16 75 / 0.13)', color: 'var(--amber)' },
    approved: { label: 'Aprobado', bg: 'oklch(0.62 0.16 160 / 0.13)', color: 'var(--green)' },
    rejected: { label: 'Rechazado', bg: 'oklch(0.62 0.22 27 / 0.13)', color: 'var(--red)' },
    sent: { label: 'Enviado', bg: 'oklch(0.62 0.16 160 / 0.13)', color: 'var(--green)' },
    error: { label: 'Error', bg: 'oklch(0.62 0.22 27 / 0.13)', color: 'var(--red)' },
  };
  const def = map[status] || map.none;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ background: def.bg, color: def.color }}>
      {def.label}
    </span>
  );
}
