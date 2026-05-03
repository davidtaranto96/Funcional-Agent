'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, Save, FileDown } from 'lucide-react';
import { Field, inputCls, textareaCls, selectCls, PrimaryButton, SecondaryButton } from '@/components/admin/FormPrimitives';
import { showToast } from '@/components/ui/toast';
import type { InvoiceItem } from '@/lib/db';
import { formatARS } from '@/lib/utils';

interface ProjectLite { id: string; title: string; client_name: string; client_id: string; budget: string }
interface ClientLite { id: string; name: string; email: string }

interface Props {
  projects: ProjectLite[];
  clients: ClientLite[];
  initial?: {
    id?: string;
    number?: string;
    client_id?: string;
    client_name?: string;
    project_id?: string;
    issue_date?: string;
    due_date?: string;
    currency?: string;
    notes?: string;
    items?: InvoiceItem[];
    status?: string;
  };
}

export function FacturaForm({ projects, clients, initial }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [number, setNumber] = useState(initial?.number || '');
  const [clientId, setClientId] = useState(initial?.client_id || '');
  const [clientName, setClientName] = useState(initial?.client_name || '');
  const [projectId, setProjectId] = useState(initial?.project_id || '');
  const [issueDate, setIssueDate] = useState(initial?.issue_date || new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(initial?.due_date || '');
  const [currency, setCurrency] = useState(initial?.currency || 'ARS');
  const [status, setStatus] = useState(initial?.status || 'draft');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [items, setItems] = useState<InvoiceItem[]>(initial?.items?.length ? initial.items : [{ description: '', quantity: 1, unit_price: 0 }]);

  const total = useMemo(() => items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.unit_price || 0)), 0), [items]);

  function setItem(i: number, patch: Partial<InvoiceItem>) {
    setItems(curr => curr.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function addItem() {
    setItems(curr => [...curr, { description: '', quantity: 1, unit_price: 0 }]);
  }
  function removeItem(i: number) {
    setItems(curr => curr.length === 1 ? curr : curr.filter((_, idx) => idx !== i));
  }

  function applyClient(id: string) {
    setClientId(id);
    const c = clients.find(x => x.id === id);
    if (c) setClientName(c.name);
  }

  function applyProject(id: string) {
    setProjectId(id);
    const p = projects.find(x => x.id === id);
    if (p) {
      if (!clientName && p.client_name) setClientName(p.client_name);
      if (p.client_id && !clientId) setClientId(p.client_id);
      // Si hay 1 solo item vacío y el proyecto tiene budget, lo usamos como sugerencia
      if (items.length === 1 && !items[0].description && !items[0].unit_price) {
        const budgetNum = parseFloat(String(p.budget || '0').replace(/[^\d.-]/g, ''));
        setItems([{
          description: `Proyecto: ${p.title}`,
          quantity: 1,
          unit_price: Number.isFinite(budgetNum) ? budgetNum : 0,
        }]);
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) {
      showToast('Falta el nombre del cliente', 'err');
      return;
    }
    if (items.length === 0 || items.every(i => !i.description.trim())) {
      showToast('Agregá al menos un item con descripción', 'err');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        number: number.trim(),
        client_id: clientId,
        client_name: clientName.trim(),
        project_id: projectId,
        issue_date: issueDate,
        due_date: dueDate,
        currency,
        status,
        notes,
        items: items.filter(i => i.description.trim()),
      };
      const url = initial?.id ? `/api/admin/facturas/${initial.id}/update` : '/api/admin/facturas/create';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar');
      showToast(initial?.id ? 'Factura actualizada' : 'Factura creada', 'ok');
      router.push(`/admin/facturas/${data.id || initial?.id}`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      showToast(msg, 'err');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Cabecera */}
      <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)] p-5">
        <h2 className="text-[14px] font-semibold text-foreground mb-4">Datos del comprobante</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Número (opcional)" hint="Si lo dejás vacío, se autoasigna 2026-0001, 2026-0002, etc.">
            <input
              value={number}
              onChange={e => setNumber(e.target.value)}
              placeholder="Ej. 2026-0001"
              className={inputCls + ' mono'}
            />
          </Field>
          <Field label="Estado">
            <select value={status} onChange={e => setStatus(e.target.value)} className={selectCls}>
              <option value="draft">Borrador</option>
              <option value="sent">Enviada</option>
              <option value="paid">Pagada</option>
              <option value="cancelled">Anulada</option>
            </select>
          </Field>
          <Field label="Fecha de emisión" required>
            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={inputCls} required />
          </Field>
          <Field label="Fecha de vencimiento" hint="Vacío = sin vencimiento. Si vence sin pago, pasa a 'vencida'.">
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
          </Field>
        </div>
      </div>

      {/* Cliente / proyecto */}
      <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)] p-5">
        <h2 className="text-[14px] font-semibold text-foreground mb-4">Cliente y proyecto</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Cliente del CRM" hint="Opcional — solo para vincular y autocompletar.">
            <select value={clientId} onChange={e => applyClient(e.target.value)} className={selectCls}>
              <option value="">— sin vincular —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.email ? ` · ${c.email}` : ''}</option>
              ))}
            </select>
          </Field>
          <Field label="Razón social / Nombre" required>
            <input value={clientName} onChange={e => setClientName(e.target.value)} className={inputCls} required />
          </Field>
          <Field label="Proyecto vinculado" hint="Si lo elegís, se autocompleta el item con el budget." className="md:col-span-2">
            <select value={projectId} onChange={e => applyProject(e.target.value)} className={selectCls}>
              <option value="">— ninguno —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title}{p.client_name ? ` · ${p.client_name}` : ''}{p.budget ? ` · ${p.budget}` : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Items */}
      <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold text-foreground">Conceptos</h2>
          <div className="flex items-center gap-2">
            <select value={currency} onChange={e => setCurrency(e.target.value)} className={selectCls + ' w-auto'}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 h-8 px-3 rounded-md bg-[var(--accent-dim)] text-[var(--accent-strong)] text-[11px] font-semibold hover:bg-[var(--accent)] hover:text-white transition-colors"
            >
              <Plus className="w-3 h-3" /> Item
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 px-1 mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <span className="col-span-6">Descripción</span>
            <span className="col-span-2 text-right">Cant.</span>
            <span className="col-span-2 text-right">Precio U.</span>
            <span className="col-span-2 text-right">Subtotal</span>
          </div>
          {items.map((it, i) => {
            const subtotal = Number(it.quantity || 0) * Number(it.unit_price || 0);
            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input
                  value={it.description}
                  onChange={e => setItem(i, { description: e.target.value })}
                  placeholder="Ej. Desarrollo de landing page"
                  className={inputCls + ' col-span-6'}
                />
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={it.quantity}
                  onChange={e => setItem(i, { quantity: Number(e.target.value) })}
                  className={inputCls + ' col-span-2 text-right mono'}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={it.unit_price}
                  onChange={e => setItem(i, { unit_price: Number(e.target.value) })}
                  className={inputCls + ' col-span-2 text-right mono'}
                />
                <div className="col-span-2 flex items-center gap-1.5">
                  <span className="flex-1 text-right mono text-[12px] text-foreground">
                    {currency === 'USD' ? `US$ ${subtotal.toFixed(2)}` : formatARS(subtotal)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    className="grid place-items-center w-7 h-7 rounded text-muted-foreground hover:text-[var(--red)] hover:bg-[oklch(0.62_0.22_27_/_0.10)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Borrar item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-[var(--border)] flex justify-end items-baseline gap-3">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Total</span>
          <span className="mono text-[20px] font-bold text-foreground" style={{ letterSpacing: '-0.5px' }}>
            {currency === 'USD' ? `US$ ${total.toFixed(2)}` : formatARS(total)}
          </span>
        </div>
      </div>

      {/* Notas */}
      <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] shadow-[var(--shadow-soft)] p-5">
        <Field label="Notas / observaciones" hint="Visibles solo para vos. Ej. medio de pago, condiciones, recordatorios.">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className={textareaCls}
            placeholder="Ej. Cobrar por transferencia. Recordar enviar resumen al cliente la próxima semana."
          />
        </Field>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 sticky bottom-4 bg-card border border-[var(--border-strong)] rounded-md px-4 py-3 shadow-[var(--shadow-elev)]">
        <Link href="/admin/facturas" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
          Cancelar
        </Link>
        <div className="flex items-center gap-2">
          {initial?.id && (
            <SecondaryButton type="button" onClick={() => window.print()}>
              <FileDown className="w-3.5 h-3.5" /> Imprimir / PDF
            </SecondaryButton>
          )}
          <PrimaryButton type="submit" disabled={submitting}>
            <Save className="w-3.5 h-3.5" />
            {submitting ? 'Guardando…' : initial?.id ? 'Guardar cambios' : 'Crear factura'}
          </PrimaryButton>
        </div>
      </div>
    </form>
  );
}
