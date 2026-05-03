export const APP_VERSION = '5.0.0-alpha.1';

export type StageKey =
  | 'lead' | 'qualified' | 'demo_pending' | 'demo_sent'
  | 'negotiating' | 'won' | 'lost' | 'dormant';

export const STAGES: { key: StageKey; label: string; dot: string }[] = [
  { key: 'lead',          label: 'Lead',           dot: 'oklch(0.62 0.18 250)' },
  { key: 'qualified',     label: 'Calificado',     dot: 'oklch(0.62 0.16 200)' },
  { key: 'demo_pending',  label: 'Demo pendiente', dot: 'oklch(0.74 0.16 75)' },
  { key: 'demo_sent',     label: 'Demo enviada',   dot: 'oklch(0.62 0.18 290)' },
  { key: 'negotiating',   label: 'Negociando',     dot: 'oklch(0.62 0.20 250)' },
  { key: 'won',           label: 'Ganado',         dot: 'oklch(0.62 0.16 160)' },
  { key: 'lost',          label: 'Perdido',        dot: 'oklch(0.62 0.22 27)' },
  { key: 'dormant',       label: 'Dormido',        dot: 'oklch(0.5 0.05 250)' },
];

export type ProjectStatus =
  | 'planning' | 'in_progress' | 'waiting_client' | 'waiting_payment'
  | 'review' | 'delivered' | 'paused' | 'cancelled';

export const PROJECT_STATUS: { key: ProjectStatus; label: string; color: string }[] = [
  { key: 'planning',         label: 'Planificación',     color: 'oklch(0.62 0.18 250)' },
  { key: 'in_progress',      label: 'En curso',          color: 'oklch(0.62 0.20 250)' },
  { key: 'waiting_client',   label: 'Esperando cliente', color: 'oklch(0.74 0.16 75)' },
  { key: 'waiting_payment',  label: 'Esperando pago',    color: 'oklch(0.74 0.16 75)' },
  { key: 'review',           label: 'En revisión',       color: 'oklch(0.62 0.18 290)' },
  { key: 'delivered',        label: 'Entregado',         color: 'oklch(0.62 0.16 160)' },
  { key: 'paused',           label: 'Pausado',           color: 'oklch(0.5 0.05 250)' },
  { key: 'cancelled',        label: 'Cancelado',         color: 'oklch(0.62 0.22 27)' },
];

export type DemoStatus = 'none' | 'generating' | 'pending_review' | 'approved' | 'rejected' | 'sent';

export type TaskStatusKey = 'todo' | 'in_progress' | 'done';

export const TASK_STATUS: { key: TaskStatusKey; label: string; color: string }[] = [
  { key: 'todo',         label: 'Pendiente',   color: 'oklch(0.5 0.05 250)' },
  { key: 'in_progress',  label: 'En progreso', color: 'oklch(0.62 0.20 250)' },
  { key: 'done',         label: 'Completada',  color: 'oklch(0.62 0.16 160)' },
];

export type TaskPriority = 'high' | 'medium' | 'low';

export interface Task {
  text: string;
  done: boolean;
  status?: TaskStatusKey;
  priority?: TaskPriority;
  assignee?: 'david' | 'hermana' | 'cliente';
  due_date?: string;
}

export function taskStatus(t: Task): TaskStatusKey {
  if (t.done) return 'done';
  if (t.status === 'in_progress') return 'in_progress';
  return 'todo';
}
