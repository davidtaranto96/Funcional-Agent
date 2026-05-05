'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Hand, Send, Loader2, MessageSquare } from 'lucide-react';
import { showToast } from '@/components/ui/toast';

interface Props {
  phone: string;
  initialPaused: boolean;
}

export function ManualControl({ phone, initialPaused }: Props) {
  const router = useRouter();
  const [paused, setPaused] = useState(initialPaused);
  const [togglingPending, startToggle] = useTransition();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function toggleBot() {
    const next = !paused;
    setPaused(next); // optimistic
    startToggle(async () => {
      try {
        const res = await fetch(`/api/admin/clients/${encodeURIComponent(phone)}/toggle-bot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paused: next }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setPaused(!next); // rollback
          showToast(data?.error || 'No pude cambiar el estado', 'err');
          return;
        }
        showToast(next ? 'Bot pausado, ahora respondés vos' : 'Bot activo de nuevo', 'ok');
        router.refresh();
      } catch (err) {
        setPaused(!next);
        showToast(err instanceof Error ? err.message : 'Error de red', 'err');
      }
    });
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(phone)}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data?.error || 'No pude enviar', 'err');
        return;
      }
      setText('');
      showToast('Mensaje enviado', 'ok');
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error de red', 'err');
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl/Cmd + Enter envia
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  }

  return (
    <div
      className="bg-card rounded-[var(--r-lg)] border shadow-[var(--shadow-soft)] overflow-hidden"
      style={{
        borderColor: paused ? 'color-mix(in oklch, var(--amber) 35%, var(--border))' : 'var(--border)',
      }}
    >
      {/* Header con toggle */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]"
        style={{ background: paused ? 'color-mix(in oklch, var(--amber) 6%, transparent)' : undefined }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="grid place-items-center w-8 h-8 rounded-md"
            style={{
              background: paused ? 'color-mix(in oklch, var(--amber) 14%, transparent)' : 'color-mix(in oklch, var(--accent) 14%, transparent)',
              color: paused ? 'var(--amber)' : 'var(--accent-strong)',
            }}
          >
            {paused ? <Hand className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-foreground">
              {paused ? 'Modo manual' : 'Bot activo'}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {paused
                ? 'Vos respondés. Los mensajes del cliente entran pero el bot NO contesta.'
                : 'El bot está respondiendo automáticamente.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleBot}
          disabled={togglingPending}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold transition-all disabled:opacity-60"
          style={{
            background: paused ? 'var(--accent)' : 'var(--amber)',
            color: paused ? 'white' : 'var(--bg)',
            boxShadow: paused ? '0 2px 10px var(--accent-glow)' : '0 2px 10px color-mix(in oklch, var(--amber) 30%, transparent)',
          }}
        >
          {togglingPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (paused ? <Bot className="w-3.5 h-3.5" /> : <Hand className="w-3.5 h-3.5" />)}
          {paused ? 'Devolver al bot' : 'Tomar control manual'}
        </button>
      </div>

      {/* Caja de envio */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Responder al cliente
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">
          Escribí acá y se envía por WhatsApp al cliente. Queda en el historial como si lo hubiera mandado el bot.
          {!paused && ' Tip: pausá el bot antes para evitar que conteste mientras vos escribís.'}
        </p>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escribí tu mensaje..."
          rows={3}
          className="w-full rounded-md bg-[var(--bg-input)] border border-[var(--border)] px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)] resize-y min-h-[64px]"
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] text-muted-foreground italic">
            Ctrl+Enter para enviar
          </p>
          <button
            type="button"
            onClick={send}
            disabled={sending || !text.trim()}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {sending ? 'Enviando...' : 'Enviar por WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  );
}
