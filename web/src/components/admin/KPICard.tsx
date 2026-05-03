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
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    // bar: pequeño retraso, anim larga (1.2s) via CSS transition
    const barTimer = setTimeout(() => setBarW(pct), 200 + delay);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(barTimer);
    };
  }, [value, pct, delay]);

  const baseClass = cn(
    'relative block bg-card rounded-[var(--r-lg)] border border-[var(--border)] overflow-hidden',
    'shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-200',
    'px-[18px] pt-[18px] pb-[15px]',
    href && 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-elev)] cursor-pointer',
  );

  const inner = (
    <>
      {/* Glow radial sólo en esquina sup-der, sutil */}
      <div
        className="pointer-events-none absolute top-0 right-0 w-[70px] h-[70px] rounded-full"
        style={{
          background: `radial-gradient(circle at 100% 0%, color-mix(in oklch, ${color} 18%, transparent), transparent 70%)`,
        }}
        aria-hidden
      />
      {/* Header: label + dot indicator */}
      <div className="relative flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <div
          className="w-[22px] h-[22px] rounded-md grid place-items-center"
          style={{ background: `color-mix(in oklch, ${color} 13%, transparent)` }}
        >
          <span
            className="block w-1.5 h-1.5 rounded-full"
            style={{
              background: color,
              boxShadow: alert ? `0 0 8px ${color}` : 'none',
            }}
          />
        </div>
      </div>
      {/* Number — mono, white, big */}
      <div
        className="relative mono text-[32px] font-bold leading-none text-foreground"
        style={{ letterSpacing: '-1.5px' }}
      >
        {display}
      </div>
      <div className="relative mt-[7px] text-[11px] text-muted-foreground">{sub}</div>
      <div className="relative mt-3 h-0.5 rounded-sm bg-[var(--bg-inset)] overflow-hidden">
        <div
          className="h-full rounded-sm"
          style={{
            width: `${barW}%`,
            background: color,
            transition: 'width 1.2s cubic-bezier(.25,.46,.45,.94)',
          }}
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
