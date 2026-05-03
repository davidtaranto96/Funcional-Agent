'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, RefreshCcw, Sparkles, X, Send } from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import { confirmDialog } from '@/components/admin/ConfirmModal';
import { Field, inputCls, textareaCls, PrimaryButton, SecondaryButton } from '@/components/admin/FormPrimitives';

export function QuickControls({ defaultPhone }: { defaultPhone?: string }) {
  const router = useRouter();
  const [showWA, setShowWA] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function syncDrive() {
    setBusy('sync');
    try {
      const r = await fetch('/api/admin/quick-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-drive' }),
      });
      const d = await r.json();
      if (d.ok) {
        showToast('Drive sincronizado', 'ok');
        router.refresh();
      } else {
        showToast(d.error || 'Error', 'err');
      }
    } catch {
      showToast('Error de red', 'err');
    } finally {
      setBusy(null);
    }
  }

  async function regenerateLast() {
    const ok = await confirmDialog({
      title: '¿Regenerar último demo?',
      description: 'Se va a regenerar el demo del último cliente con demo enviado/aprobado. El cliente NO va a recibir nada hasta que apruebes.',
      confirmLabel: 'Regenerar',
      variant: 'warning',
    });
    if (!ok) return;

    setBusy('regen');
    try {
      const r = await fetch('/api/admin/quick-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate-last-demo' }),
      });
      const d = await r.json();
      if (d.ok) {
        showToast(d.message || 'Regenerando...', 'ok');
        if (d.phone) setTimeout(() => router.push(`/admin/client/${encodeURIComponent(d.phone)}`), 800);
      } else {
        showToast(d.error || 'Sin demos para regenerar', 'err');
      }
    } catch {
      showToast('Error de red', 'err');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <QuickButton
          icon={<MessageSquare className="w-3.5 h-3.5" />}
          label="Test WhatsApp"
          sub="Mandar mensaje de prueba"
          onClick={() => setShowWA(true)}
          busy={false}
        />
        <QuickButton
          icon={<RefreshCcw className={`w-3.5 h-3.5 ${busy === 'sync' ? 'animate-spin' : ''}`} />}
          label="Sync Drive"
          sub="Forzar sincronización"
          onClick={syncDrive}
          busy={busy === 'sync'}
        />
        <QuickButton
          icon={<Sparkles className="w-3.5 h-3.5" />}
          label="Regenerar demo"
          sub="Última conversación"
          onClick={regenerateLast}
          busy={busy === 'regen'}
        />
      </div>

      {showWA && (
        <TestWhatsAppModal
          defaultPhone={defaultPhone}
          onClose={() => setShowWA(false)}
        />
      )}
    </>
  );
}

function QuickButton({
  icon, label, sub, onClick, busy,
}: { icon: React.ReactNode; label: string; sub: string; onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="bg-card border border-[var(--border)] rounded-[var(--r-md)] p-3 text-left hover:border-[var(--border-strong)] hover:bg-[var(--bg-inset)] transition-all group disabled:opacity-60 disabled:cursor-wait"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="grid place-items-center w-6 h-6 rounded bg-[var(--bg-inset)] text-muted-foreground group-hover:text-[var(--accent)] transition-colors">
          {icon}
        </div>
        <span className="text-[12px] font-semibold text-foreground">{label}</span>
      </div>
      <p className="text-[10px] text-muted-foreground ml-8">{sub}</p>
    </button>
  );
}

function TestWhatsAppModal({ defaultPhone, onClose }: { defaultPhone?: string; onClose: () => void }) {
  const [phone, setPhone] = useState(defaultPhone || '');
  const [message, setMessage] = useState('🤖 Test desde DT Systems · ' + new Date().toLocaleTimeString('es-AR'));
  const [sending, setSending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setSending(true);
    try {
      const r = await fetch('/api/admin/quick-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-whatsapp', phone: phone.trim(), message: message.trim() }),
      });
      const d = await r.json();
      if (d.ok) {
        showToast(`Mensaje enviado a ${phone}`, 'ok');
        onClose();
      } else {
        showToast(d.error || 'Error al enviar', 'err');
      }
    } catch {
      showToast('Error de red', 'err');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-4 pd-fade-in"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={send}
        onClick={e => e.stopPropagation()}
        className="bg-card border border-[var(--border-strong)] rounded-[var(--r-xl)] shadow-[var(--shadow-elev)] w-full max-w-[480px] pd-modal-in"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="grid place-items-center w-9 h-9 rounded-md flex-shrink-0"
              style={{ background: 'oklch(0.62 0.16 160 / 0.13)', color: 'var(--green)' }}
            >
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold text-foreground">Test WhatsApp</h2>
              <p className="text-[11px] text-muted-foreground">Manda un mensaje de prueba via Twilio</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid place-items-center w-7 h-7 rounded text-muted-foreground hover:text-foreground hover:bg-[var(--bg-inset)] transition-colors flex-shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <Field label="Teléfono destino" required hint="Formato internacional sin +. Ej: 5491123456789">
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              autoFocus
              required
              className={inputCls + ' mono'}
              placeholder="5491123456789"
            />
          </Field>
          <Field label="Mensaje">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              className={textareaCls}
              maxLength={1500}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 px-5 pb-4 border-t border-[var(--border)] pt-3">
          <SecondaryButton type="button" onClick={onClose} disabled={sending}>Cancelar</SecondaryButton>
          <PrimaryButton type="submit" disabled={sending || !phone.trim()}>
            {sending ? <><RefreshCcw className="w-3.5 h-3.5 animate-spin" /> Enviando…</> : <><Send className="w-3.5 h-3.5" /> Enviar</>}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
