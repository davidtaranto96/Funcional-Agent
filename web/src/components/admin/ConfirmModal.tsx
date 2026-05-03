'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type Variant = 'danger' | 'warning' | 'default';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
}

type Resolver = (ok: boolean) => void;

let openFn: ((opts: ConfirmOptions, resolve: Resolver) => void) | null = null;

/**
 * Reemplazo estilizado de window.confirm. Devuelve una Promise<boolean>.
 * Requiere <ConfirmModal /> montado en el árbol (lo está en /admin/layout).
 *
 * Ejemplo:
 *   if (await confirmDialog({ title: '¿Borrar proyecto?', variant: 'danger' })) { ... }
 */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    if (openFn) openFn(opts, resolve);
    else resolve(window.confirm(opts.title));
  });
}

/**
 * Helper para forms: úsalo en onSubmit como
 *   <form onSubmit={confirmFormSubmit({ title: '¿Borrar?', variant: 'danger' })}>
 */
export function confirmFormSubmit(opts: ConfirmOptions) {
  return async (e: React.FormEvent<HTMLFormElement>) => {
    if ((e.currentTarget as HTMLFormElement & { _pdConfirmed?: boolean })._pdConfirmed) return;
    e.preventDefault();
    const form = e.currentTarget;
    const ok = await confirmDialog(opts);
    if (ok) {
      (form as HTMLFormElement & { _pdConfirmed?: boolean })._pdConfirmed = true;
      form.requestSubmit();
    }
  };
}

const variantStyles: Record<Variant, { color: string; Icon: React.ComponentType<{ className?: string }>; cta: string }> = {
  danger:  { color: 'oklch(0.62 0.22 27)',  Icon: AlertTriangle, cta: 'bg-[var(--red)]' },
  warning: { color: 'oklch(0.74 0.16 75)',  Icon: AlertTriangle, cta: 'bg-[var(--amber)] text-[var(--bg)]' },
  default: { color: 'oklch(0.62 0.20 250)', Icon: AlertTriangle, cta: 'bg-primary' },
};

export function ConfirmModal() {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: Resolver } | null>(null);

  useEffect(() => {
    openFn = (opts, resolve) => setState({ opts, resolve });
    return () => { openFn = null; };
  }, []);

  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function close(ok: boolean) {
    if (!state) return;
    state.resolve(ok);
    setState(null);
  }

  if (!state) return null;
  const { opts } = state;
  const variant = opts.variant || 'default';
  const v = variantStyles[variant];
  const ctaTextColor = variant === 'warning' ? 'text-[var(--bg)]' : 'text-white';

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-4 pd-fade-in"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={() => close(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card border border-[var(--border-strong)] rounded-[var(--r-xl)] shadow-[var(--shadow-elev)] w-full max-w-[420px] pd-modal-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-3.5 mb-4">
            <div
              className="grid place-items-center w-10 h-10 rounded-lg flex-shrink-0"
              style={{ background: `color-mix(in oklch, ${v.color} 14%, transparent)`, color: v.color }}
            >
              <v.Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[15px] font-semibold text-foreground">{opts.title}</h2>
              {opts.description && (
                <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{opts.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => close(false)}
              className="grid place-items-center w-7 h-7 rounded text-muted-foreground hover:text-foreground hover:bg-[var(--bg-inset)] transition-colors flex-shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => close(false)}
              className="inline-flex items-center justify-center h-9 px-3.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-[var(--bg-inset)] transition-colors"
            >
              {opts.cancelLabel || 'Cancelar'}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => close(true)}
              className={`inline-flex items-center justify-center h-9 px-4 rounded-md ${ctaTextColor} text-[12px] font-semibold transition-all hover:brightness-110 ${v.cta}`}
              style={{ boxShadow: `0 2px 12px color-mix(in oklch, ${v.color} 30%, transparent)` }}
            >
              {opts.confirmLabel || 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
