'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { showToast } from '@/components/ui/toast';

interface Props {
  phone: string;
  currentName: string;            // lo que se muestra hoy (nickname || reportName || phone)
  hasReportName: boolean;         // si hay nombre del reporte (no se sobreescribe sin razon)
  hasNickname: boolean;           // si ya hay nickname guardado
}

export function NicknameEditor({ phone, currentName, hasReportName, hasNickname }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(hasNickname ? currentName : '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(phone)}/nickname`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data?.error || 'No pude guardar', 'err');
        return;
      }
      showToast(value.trim() ? 'Nombre guardado' : 'Alias borrado', 'ok');
      setEditing(false);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error de red', 'err');
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setValue(hasNickname ? currentName : '');
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[var(--accent-strong)] transition-colors mt-1"
        title={hasNickname ? 'Editar alias' : (hasReportName ? 'Sobreescribir nombre con un alias propio' : 'Asignar nombre/alias para identificar este contacto')}
      >
        <Pencil className="w-2.5 h-2.5" />
        {hasNickname ? 'Editar alias' : 'Poner alias'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-1.5 max-w-[320px]">
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') cancel();
        }}
        placeholder="Nombre o alias..."
        maxLength={80}
        className="flex-1 h-7 px-2 text-[12px] rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-foreground placeholder:text-muted-foreground outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)]"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="grid place-items-center w-7 h-7 rounded-md bg-[var(--accent)] text-white hover:brightness-110 transition-all disabled:opacity-50"
        title="Guardar"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={saving}
        className="grid place-items-center w-7 h-7 rounded-md bg-card border border-[var(--border)] text-muted-foreground hover:text-foreground transition-colors"
        title="Cancelar"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
