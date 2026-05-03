import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground',
        primary: 'bg-[var(--accent-dim)] text-[var(--accent-strong)]',
        success: 'bg-[oklch(0.62_0.16_160_/_0.13)] text-[var(--green)]',
        warn: 'bg-[oklch(0.74_0.16_75_/_0.13)] text-[var(--amber)]',
        danger: 'bg-[oklch(0.62_0.22_27_/_0.13)] text-[var(--red)]',
        outline: 'border border-[var(--border-strong)] text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
