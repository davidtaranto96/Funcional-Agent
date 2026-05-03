// Form primitives — pulido al estilo Precision Dark.
// Usá estos en lugar de los <Input>/<Label> de shadcn cuando trabajés en pantallas
// del nuevo design system.

export const inputCls =
  'flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-3 text-[12px] ' +
  'text-foreground placeholder:text-muted-foreground outline-none ' +
  'focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)] transition-colors';

export const textareaCls = inputCls + ' resize-none py-2';

export const selectCls = inputCls + ' cursor-pointer';

export function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className || ''}`}>
      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
        {label}
        {required && <span className="text-[var(--red)] ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[10px] text-muted-foreground mt-1">{hint}</span>}
    </label>
  );
}

export function PrimaryButton({
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-primary text-white text-[12px] font-semibold transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{ boxShadow: '0 2px 10px var(--accent-glow)', ...(rest.style || {}) }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-md bg-[var(--bg-card-2)] border border-[var(--border)] text-[12px] font-medium text-foreground hover:bg-[var(--bg-elevated)] transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostDangerButton({
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md text-[12px] font-medium text-[var(--red)] hover:bg-[oklch(0.62_0.22_27_/_0.10)] transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
