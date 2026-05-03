'use client';

import { useEffect, useState } from 'react';

interface Props {
  contactsCount: number;
  projectsCount: number;
  pendingTasks: number;
  pendingReview: number;
}

const FORMATTER = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function greeting(h: number) {
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export function DashboardHeader({ contactsCount, projectsCount, pendingTasks, pendingReview }: Props) {
  // Render-time SSR friendly: empezamos con valor base que luego corregimos en cliente
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hour = now?.getHours() ?? 12;
  const dateLabel = now ? FORMATTER.format(now) : '';
  const hello = greeting(hour);

  return (
    <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight text-foreground leading-tight">
          {hello}, David
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1 capitalize">
          {dateLabel || `${contactsCount} contactos · ${projectsCount} proyectos · ${pendingTasks} tareas pendientes`}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {pendingReview > 0 && (
          <a
            href="/admin/clients"
            className="flex items-center gap-1.5 text-[11px] text-[var(--amber)] bg-[oklch(0.74_0.16_75_/_0.10)] border border-[oklch(0.74_0.16_75_/_0.25)] rounded-lg px-2.5 py-1.5 hover:bg-[oklch(0.74_0.16_75_/_0.16)] transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
            {pendingReview} demo{pendingReview !== 1 ? 's' : ''} para revisar
          </a>
        )}
        <div className="flex items-center gap-1.5 mono text-[11px] text-muted-foreground bg-card border border-[var(--border)] rounded-lg px-2.5 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse" />
          Sistema activo
        </div>
      </div>
    </div>
  );
}
