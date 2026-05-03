'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface KPICardProps {
  label: string;
  value: number;
  sub?: string;
  href?: string;
  color?: string;
  pct?: number;
  delay?: number;
  alert?: boolean;
}

export function KPICard({ label, value, sub, href, color = 'var(--accent)', pct = 0, delay = 0, alert }: KPICardProps) {
  const [display, setDisplay] = useState(0);
  const [barW, setBarW] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setDisplay(value);
      setBarW(pct);
      return;
    }
    const start = performance.now() + delay;
    const dur = 800;
    let frame: number;
    function tick(now: number) {
      const elapsed = now - start;
      if (elapsed < 0) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, elapsed / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      setBarW(Math.round(pct * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, pct, delay]);

  const baseClass = cn(
    'relative block bg-card rounded-xl border border-[var(--border)] p-4 overflow-hidden',
    'shadow-[var(--shadow-soft)] transition-transform',
    href && 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-elev)]',
  );

  const inner = (
    <>
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{ background: `radial-gradient(circle at 100% 0%, ${color}, transparent 70%)` }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{label}</span>
        {alert && <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />}
      </div>
      <div className="relative mono text-3xl md:text-4xl font-semibold leading-none" style={{ color }}>
        {display}
      </div>
      <div className="relative mt-1.5 text-xs text-muted-foreground">{sub}</div>
      <div className="relative mt-3 h-1 rounded-full bg-[var(--bg-inset)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${barW}%`, background: color }}
        />
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={baseClass} style={{ animationDelay: `${delay}ms` }}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={baseClass} style={{ animationDelay: `${delay}ms` }}>
      {inner}
    </div>
  );
}
