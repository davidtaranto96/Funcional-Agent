'use client';

import { useRef } from 'react';
import { confirmDialog } from './ConfirmModal';

/**
 * <form> wrapper que muestra un ConfirmModal antes de enviar.
 * Útil desde server components — pasa el form HTML como children.
 *
 * Uso:
 *   <ConfirmForm
 *     action={`/api/admin/projects/${id}/delete`}
 *     method="POST"
 *     confirm={{ title: '¿Borrar proyecto?', variant: 'danger' }}
 *   >
 *     <button type="submit">Borrar</button>
 *   </ConfirmForm>
 */
interface ConfirmFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  confirm: {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'default';
  };
  children: React.ReactNode;
}

export function ConfirmForm({ confirm, children, ...formProps }: ConfirmFormProps) {
  const ref = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (confirmedRef.current) return;
    e.preventDefault();
    const ok = await confirmDialog(confirm);
    if (ok) {
      confirmedRef.current = true;
      ref.current?.requestSubmit();
    }
  }

  return (
    <form ref={ref} onSubmit={onSubmit} {...formProps}>
      {children}
    </form>
  );
}
