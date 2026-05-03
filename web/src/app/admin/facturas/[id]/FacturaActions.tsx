'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Trash2, Send, FileDown, Ban } from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import { confirmDialog } from '@/components/admin/ConfirmModal';

export function FacturaActions({ id, status, currentMethod }: { id: string; status: string; currentMethod: string }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [method, setMethod] = useState(currentMethod || 'Transferencia');

  async function changeStatus(newStatus: string) {
    setWorking(true);
    try {
      const res = await fetch(`/api/admin/facturas/${id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Error');
      showToast(`Estado: ${newStatus}`, 'ok');
      router.refresh();
    } catch {
      showToast('No se pudo cambiar el estado', 'err');
    } finally {
      setWorking(false);
    }
  }

  async function markPaid() {
    setWorking(true);
    try {
      const res = await fetch(`/api/admin/facturas/${id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });
      if (!res.ok) throw new Error('Error');
      showToast('Marcada como pagada', 'ok');
      setShowPaidModal(false);
      router.refresh();
    } catch {
      showToast('Error al marcar pago', 'err');
    } finally {
      setWorking(false);
    }
  }

  async function del() {
    const ok = await confirmDialog({
      title: '¿Borrar factura?',
      description: 'Esta acción no se puede deshacer. Si querés conservarla pero invalidarla, usá "Anular".',
      confirmLabel: 'Sí, borrar',
      variant: 'danger',
    });
    if (!ok) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/admin/facturas/${id}/delete`, { method: 'POST' });
      if (!res.ok) throw new Error('Error');
      showToast('Factura borrada', 'ok');
      router.push('/admin/facturas');
    } catch {
      showToast('No se pudo borrar', 'err');
      setWorking(false);
    }
  }

  return (
    <>
      {status === 'draft' && (
        <button
          type="button"
          onClick={() => changeStatus('sent')}
          disabled={working}
          className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent-dim)] border border-[var(--accent)] text-[var(--accent-strong)] text-[12px] font-semibold hover:bg-[var(--accent)] hover:text-white transition-colors disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" /> Marcar como enviada
        </button>
      )}
      {(status === 'sent' || status === 'overdue') && (
        <button
          type="button"
          onClick={() => setShowPaidModal(true)}
          disabled={working}
          className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-[oklch(0.62_0.16_160_/_0.15)] border border-[var(--green)] text-[var(--green)] text-[12px] font-semibold hover:bg-[var(--green)] hover:text-white transition-colors disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" /> Marcar pagada
        </button>
      )}
      {status !== 'cancelled' && status !== 'paid' && (
        <button
          type="button"
          onClick={() => changeStatus('cancelled')}
          disabled={working}
          className="grid place-items-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-[var(--bg-inset)] transition-colors disabled:opacity-50"
          title="Anular"
        >
          <Ban className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={() => { if (typeof window !== 'undefined') window.print(); }}
        className="grid place-items-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-[var(--bg-inset)] transition-colors"
        title="Imprimir / PDF"
      >
        <FileDown className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={del}
        disabled={working}
        className="grid place-items-center w-9 h-9 rounded-md text-muted-foreground hover:text-[var(--red)] hover:bg-[oklch(0.62_0.22_27_/_0.10)] transition-colors disabled:opacity-50"
        title="Borrar"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Modal medio de pago */}
      {showPaidModal && (
        <div
          className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm grid place-items-center p-4 pd-fade-in"
          onClick={() => setShowPaidModal(false)}
          role="dialog"
        >
          <div
            className="bg-card border border-[var(--border-strong)] rounded-[var(--r-lg)] shadow-[var(--shadow-elev)] p-5 w-[420px] max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[14px] font-semibold text-foreground mb-1">Marcar como pagada</h3>
            <p className="text-[11px] text-muted-foreground mb-4">¿Cómo cobraste? (opcional)</p>
            <input
              autoFocus
              value={method}
              onChange={e => setMethod(e.target.value)}
              placeholder="Ej. Transferencia, Mercado Pago, USDT, efectivo…"
              className="w-full h-9 px-3 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-[12px] text-foreground outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)]"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowPaidModal(false)}
                className="h-8 px-3 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-[var(--bg-inset)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={markPaid}
                disabled={working}
                className="flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-[var(--green)] text-white text-[12px] font-semibold hover:brightness-110 transition-all disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" /> Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
