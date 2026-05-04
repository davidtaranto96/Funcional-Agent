'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, AlertCircle, QrCode } from 'lucide-react';

type Status =
  | { state: 'loading' }
  | { state: 'connected'; user?: string }
  | { state: 'qr'; imgUrl: string }
  | { state: 'no-qr'; message: string }
  | { state: 'error'; message: string };

export function WhatsAppQRClient() {
  const [status, setStatus] = useState<Status>({ state: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);

  async function check() {
    try {
      const res = await fetch(`/api/auth/whatsapp-qr?t=${Date.now()}`, { cache: 'no-store' });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('image/png')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setStatus({ state: 'qr', imgUrl: url });
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.connected) {
        setStatus({ state: 'connected', user: data.user });
      } else if (res.status === 503) {
        setStatus({ state: 'no-qr', message: data?.hint || 'Esperando QR...' });
      } else {
        setStatus({ state: 'error', message: data?.error || `HTTP ${res.status}` });
      }
    } catch (err) {
      setStatus({ state: 'error', message: err instanceof Error ? err.message : 'Error de red' });
    }
  }

  useEffect(() => {
    check();
    // Auto-refresh cada 8s mientras no estemos conectados.
    // Baileys regenera el QR cada ~20-30s, así nos mantenemos sincronizados.
    const id = setInterval(() => {
      if (status.state !== 'connected') check();
    }, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (status.state === 'loading') {
    return (
      <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] p-12 text-center">
        <RefreshCw className="w-8 h-8 mx-auto text-muted-foreground animate-spin mb-3" />
        <p className="text-[13px] text-muted-foreground">Consultando estado...</p>
      </div>
    );
  }

  if (status.state === 'connected') {
    return (
      <div className="bg-[oklch(0.62_0.16_160_/_0.10)] border border-[var(--green)] rounded-[var(--r-lg)] p-8 text-center">
        <CheckCircle2 className="w-10 h-10 mx-auto text-[var(--green)] mb-3" />
        <h2 className="text-[15px] font-bold text-foreground mb-1">WhatsApp conectado</h2>
        <p className="text-[13px] text-muted-foreground mb-3">
          {status.user ? `Cuenta: ${status.user}` : 'El bot está activo y respondiendo mensajes.'}
        </p>
        <p className="text-[11px] text-muted-foreground italic">
          Para desvincular, andá al cel: WhatsApp → Configuración → Dispositivos vinculados.
        </p>
      </div>
    );
  }

  if (status.state === 'qr') {
    return (
      <div className="bg-card rounded-[var(--r-lg)] border border-[var(--border)] p-8">
        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-lg mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={status.imgUrl} alt="QR WhatsApp" className="w-[280px] h-[280px]" />
          </div>
          <h2 className="text-[14px] font-semibold text-foreground mb-2">
            Escaneá con WhatsApp del cel
          </h2>
          <ol className="text-[12px] text-muted-foreground space-y-1 max-w-[400px]">
            <li>1. Abrí WhatsApp en el celular</li>
            <li>2. Tocá <strong>Configuración</strong> → <strong>Dispositivos vinculados</strong></li>
            <li>3. Tocá <strong>Vincular un dispositivo</strong></li>
            <li>4. Apuntá la cámara a este QR</li>
          </ol>
          <p className="text-[10px] text-muted-foreground mt-4 italic">
            El QR se regenera cada ~20s. La página refresca automáticamente.
          </p>
          <button
            type="button"
            onClick={() => setRefreshKey(k => k + 1)}
            className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)] hover:underline"
          >
            <RefreshCw className="w-3 h-3" /> Forzar refresh
          </button>
        </div>
      </div>
    );
  }

  if (status.state === 'no-qr') {
    return (
      <div className="bg-card border border-dashed border-[var(--border-strong)] rounded-[var(--r-lg)] p-8 text-center">
        <QrCode className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-[14px] font-semibold text-foreground mb-1">QR todavía no disponible</h2>
        <p className="text-[12px] text-muted-foreground mb-3">{status.message}</p>
        <button
          type="button"
          onClick={() => setRefreshKey(k => k + 1)}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-primary text-white text-[12px] font-semibold hover:brightness-110"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-[var(--red)] rounded-[var(--r-lg)] p-8 text-center">
      <AlertCircle className="w-10 h-10 mx-auto text-[var(--red)] mb-3" />
      <h2 className="text-[14px] font-semibold text-foreground mb-1">Error</h2>
      <p className="text-[12px] text-muted-foreground mb-3">{status.message}</p>
      <button
        type="button"
        onClick={() => setRefreshKey(k => k + 1)}
        className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-card border border-[var(--border)] text-[12px] hover:bg-[var(--bg-inset)]"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Reintentar
      </button>
    </div>
  );
}
