'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square } from 'lucide-react';
import { showToast } from '@/components/ui/toast';

export function MicTextarea({ name, placeholder, rows = 3 }: { name: string; placeholder: string; rows?: number }) {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function toggle() {
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setRecording(false);
        setStatus('Transcribiendo...');
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const fd = new FormData();
          fd.append('audio', blob, 'rec.webm');
          const r = await fetch('/api/admin/transcribe', { method: 'POST', body: fd });
          const d = await r.json();
          if (d.text && textareaRef.current) {
            textareaRef.current.value = textareaRef.current.value
              ? textareaRef.current.value + ' ' + d.text
              : d.text;
            textareaRef.current.focus();
            setStatus('Listo');
          } else {
            setStatus(d.error || 'No se pudo transcribir');
            showToast('Error transcribiendo', 'err');
          }
        } catch {
          setStatus('Error');
          showToast('Error de red', 'err');
        }
        setTimeout(() => setStatus(''), 2000);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setStatus('Grabando...');
    } catch {
      showToast('Sin acceso al micrófono', 'err');
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={toggle}>
          {recording ? (
            <><Square className="w-3.5 h-3.5 fill-current" /> Parar</>
          ) : (
            <><Mic className="w-3.5 h-3.5" /> Dictar por voz</>
          )}
        </Button>
        {status && <span className="text-[10px] text-muted-foreground">{status}</span>}
      </div>
      <textarea
        ref={textareaRef}
        name={name}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-input border border-[var(--border-strong)] rounded-md px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}
