import * as db from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Edit3, Receipt, FileDown } from 'lucide-react';
import { formatARS } from '@/lib/utils';
import { FacturaActions } from './FacturaActions';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Borrador',  color: 'oklch(0.5 0.05 250)'  },
  sent:      { label: 'Enviada',   color: 'oklch(0.74 0.16 75)'  },
  paid:      { label: 'Pagada',    color: 'oklch(0.62 0.16 160)' },
  overdue:   { label: 'Vencida',   color: 'oklch(0.62 0.22 27)'  },
  cancelled: { label: 'Anulada',   color: 'oklch(0.5 0.05 250)'  },
};

export default async function FacturaDetailPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inv = await db.getInvoice(id);
  if (!inv) notFound();

  // Auto-overdue para mostrar (no muta DB)
  const today = new Date().toISOString().slice(0, 10);
  const effectiveStatus = (inv.status === 'sent' && inv.due_date && inv.due_date < today) ? 'overdue' : inv.status;
  const status = STATUS_LABELS[effectiveStatus] || STATUS_LABELS.draft;

  // El project depende del invoice (necesitamos project_id), por eso no
  // entra en Promise.all con getInvoice. Pero ya esta optimo: 1 sola query
  // mas si hay proyecto vinculado.
  const project = inv.project_id ? await db.getProject(inv.project_id) : null;

  const totalLabel = inv.currency === 'USD' ? `US$ ${inv.amount.toFixed(2)}` : formatARS(inv.amount);

  return (
    <div className="max-w-[900px] mx-auto">
      <Link href="/admin/facturas" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-3 transition-colors print:hidden">
        <ChevronLeft className="w-3 h-3" /> Volver a facturas
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap print:mb-8">
        <div className="flex items-start gap-3">
          <div
            className="grid place-items-center w-12 h-12 rounded-xl flex-shrink-0"
            style={{ background: `color-mix(in oklch, ${status.color} 14%, transparent)` }}
          >
            <Receipt className="w-6 h-6" style={{ color: status.color }} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-[22px] font-bold tracking-tight text-foreground mono">{inv.number || '— sin número —'}</h1>
              <span
                className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider rounded px-2 py-1"
                style={{ background: `color-mix(in oklch, ${status.color} 14%, transparent)`, color: status.color }}
              >
                {status.label}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              Emitida el <span className="mono">{inv.issue_date}</span>
              {inv.due_date && <> · vence el <span className="mono">{inv.due_date}</span></>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Link
            href={`/admin/facturas/${inv.id}/editar`}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-card border border-[var(--border)] text-foreground text-[12px] font-medium hover:bg-[var(--bg-inset)] transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" /> Editar
          </Link>
          <FacturaActions
            id={inv.id}
            status={effectiveStatus}
            currentMethod={inv.payment_method}
          />
        </div>
      </div>

      {/* Cliente / proyecto */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5 print:grid-cols-2">
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] p-4 print:border-black">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Facturado a</div>
          <div className="text-[14px] font-semibold text-foreground">
            {inv.client_name || <span className="text-muted-foreground italic">—</span>}
          </div>
          {inv.client_id && (
            <Link
              href={`/admin/clientes/${inv.client_id}`}
              className="text-[11px] text-[var(--accent-strong)] hover:underline mt-1 inline-block print:hidden"
            >
              Ver ficha del cliente →
            </Link>
          )}
        </div>
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] p-4 print:border-black">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Proyecto</div>
          {project ? (
            <>
              <div className="text-[14px] font-semibold text-foreground">{project.title}</div>
              <Link
                href={`/admin/projects/${project.id}`}
                className="text-[11px] text-[var(--accent-strong)] hover:underline mt-1 inline-block print:hidden"
              >
                Ver proyecto →
              </Link>
            </>
          ) : (
            <span className="text-[12px] text-muted-foreground italic">— sin proyecto vinculado —</span>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] overflow-hidden shadow-[var(--shadow-soft)] mb-5 print:border-black">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)] print:border-black">
              <th className="text-left px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Descripción</th>
              <th className="text-right px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-20">Cant.</th>
              <th className="text-right px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-32">Precio U.</th>
              <th className="text-right px-4 py-2.5 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-32">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-[12px] text-muted-foreground italic">Sin items</td>
              </tr>
            ) : inv.items.map((it, i) => {
              const subtotal = (it.quantity || 0) * (it.unit_price || 0);
              return (
                <tr key={i} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 text-[12px] text-foreground">{it.description}</td>
                  <td className="px-4 py-3 text-right mono text-[12px] text-muted-foreground">{it.quantity}</td>
                  <td className="px-4 py-3 text-right mono text-[12px] text-muted-foreground">
                    {inv.currency === 'USD' ? `US$ ${it.unit_price.toFixed(2)}` : formatARS(it.unit_price)}
                  </td>
                  <td className="px-4 py-3 text-right mono text-[12px] font-semibold text-foreground">
                    {inv.currency === 'USD' ? `US$ ${subtotal.toFixed(2)}` : formatARS(subtotal)}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-[var(--bg-inset)]">
              <td colSpan={3} className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Total</td>
              <td className="px-4 py-3 text-right mono text-[18px] font-bold text-foreground" style={{ letterSpacing: '-0.5px' }}>
                {totalLabel}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Estado de pago */}
      {inv.paid_at && (
        <div className="bg-[oklch(0.62_0.16_160_/_0.10)] border border-[oklch(0.62_0.16_160_/_0.30)] rounded-[var(--r-lg)] p-4 mb-5">
          <div className="flex items-center gap-2 text-[12px] text-[var(--green)]">
            <span className="font-semibold">Pagada el {inv.paid_at}</span>
            {inv.payment_method && <span className="text-muted-foreground">· {inv.payment_method}</span>}
          </div>
        </div>
      )}

      {/* Notas */}
      {inv.notes && (
        <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] p-4 mb-5 print:border-black">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notas</div>
          <p className="text-[13px] text-foreground whitespace-pre-wrap">{inv.notes}</p>
        </div>
      )}

      {/* Print button */}
      <div className="flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => { if (typeof window !== 'undefined') window.print(); }}
          className="hidden"
        >
          <FileDown className="w-3.5 h-3.5 inline" /> Imprimir
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-6 print:mt-12">
        Comprobante interno · DT Systems · Salta, Argentina · sin valor fiscal
      </p>
    </div>
  );
}
