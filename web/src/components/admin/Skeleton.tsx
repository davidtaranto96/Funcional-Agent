// Skeleton primitives — usar en archivos loading.tsx por ruta.

export function Skel({ w, h, className = '', radius = 'sm' }: {
  w?: string | number;
  h?: string | number;
  className?: string;
  radius?: 'sm' | 'md' | 'lg' | 'full';
}) {
  const r = radius === 'sm' ? 'rounded-[var(--r-sm)]'
          : radius === 'md' ? 'rounded-[var(--r-md)]'
          : radius === 'lg' ? 'rounded-[var(--r-lg)]'
          : 'rounded-full';
  return (
    <div
      className={`pd-shimmer ${r} ${className}`}
      style={{ width: typeof w === 'number' ? `${w}px` : w, height: typeof h === 'number' ? `${h}px` : h }}
      aria-hidden
    />
  );
}

export function SkelKpi() {
  return (
    <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] p-[18px] shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between mb-3">
        <Skel w={70} h={10} />
        <Skel w={22} h={22} radius="md" />
      </div>
      <Skel w={80} h={28} className="mb-2" />
      <Skel w="60%" h={10} className="mb-3" />
      <Skel w="100%" h={2} />
    </div>
  );
}

export function SkelHeader({ withSub = true }: { withSub?: boolean }) {
  return (
    <div className="mb-5">
      <Skel w={220} h={22} className="mb-2" />
      {withSub && <Skel w={320} h={12} />}
    </div>
  );
}

export function SkelCard({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)] overflow-hidden">
      <div className="px-4 pt-3.5 pb-2.5 border-b border-[var(--border)]">
        <Skel w={140} h={13} />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Skel w={26} h={26} radius="full" />
            <div className="flex-1 space-y-1.5">
              <Skel w={`${60 + (i * 7) % 30}%`} h={12} />
              <Skel w="40%" h={10} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkelTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)] overflow-hidden">
      <div className="border-b border-[var(--border)] px-4 py-2.5 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skel key={i} w={60 + (i * 17) % 80} h={10} />
        ))}
      </div>
      <div className="divide-y divide-[var(--border)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skel w={26} h={26} radius="full" />
            {Array.from({ length: cols - 1 }).map((_, j) => (
              <Skel key={j} w={`${30 + (i + j * 11) % 40}%`} h={12} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkelKanban({ cols = 6 }: { cols?: number }) {
  return (
    <div className="overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6 pb-4">
      <div className="flex gap-3 min-w-max">
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="w-[280px] flex-shrink-0">
            <div className="flex items-center justify-between px-1 mb-2">
              <Skel w={100} h={12} />
              <Skel w={20} h={14} />
            </div>
            <div className="bg-[var(--bg-inset)] rounded-[var(--r-md)] p-2 min-h-[400px] space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-card rounded-[var(--r-md)] p-3 border border-[var(--border)]">
                  <div className="flex items-start gap-2 mb-2">
                    <Skel w={28} h={28} radius="full" />
                    <div className="flex-1 space-y-1.5">
                      <Skel w="80%" h={12} />
                      <Skel w="60%" h={10} />
                    </div>
                  </div>
                  <Skel w="100%" h={10} className="mt-2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
