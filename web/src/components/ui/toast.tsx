'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type Toast = { id: number; msg: string; type: 'ok' | 'err' | 'info' };

let counter = 0;
let pushFn: ((t: Omit<Toast, 'id'>) => void) | null = null;

export function showToast(msg: string, type: 'ok' | 'err' | 'info' = 'ok') {
  if (pushFn) pushFn({ msg, type });
  else if (typeof window !== 'undefined') {
    // Fallback: dispatch a custom event the provider listens to
    window.dispatchEvent(new CustomEvent('pd-toast', { detail: { msg, type } }));
  }
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    pushFn = (t) => {
      const id = ++counter;
      setToasts(prev => [...prev, { ...t, id }]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 3000);
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as { msg: string; type: 'ok' | 'err' | 'info' };
      pushFn?.(detail);
    };
    window.addEventListener('pd-toast', onCustom);
    return () => {
      pushFn = null;
      window.removeEventListener('pd-toast', onCustom);
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          className={cn(
            'pointer-events-auto px-4 py-2.5 rounded-lg text-xs font-medium shadow-[var(--shadow-elev)] border',
            'animate-[pd-toast-in_0.25s_ease-out]',
            t.type === 'ok'  && 'bg-[var(--green)] text-white border-[oklch(0.62_0.16_160_/_0.5)]',
            t.type === 'err' && 'bg-[var(--red)] text-white border-[oklch(0.62_0.22_27_/_0.5)]',
            t.type === 'info' && 'bg-[var(--accent)] text-white border-[var(--accent-strong)]',
          )}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
