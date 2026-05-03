import { PROJECT_STATUS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function ProjectStatusBadge({ status, className }: { status: string; className?: string }) {
  const def = PROJECT_STATUS.find(s => s.key === status) || PROJECT_STATUS[0];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs', className)}
      style={{ background: 'var(--bg-card-2)', color: 'var(--text-2)' }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: def.color, boxShadow: `0 0 6px ${def.color}` }} />
      {def.label}
    </span>
  );
}
