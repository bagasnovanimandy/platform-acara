import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

function Alert({
  className,
  variant = 'default',
  ...props
}: ComponentProps<'div'> & { variant?: 'default' | 'destructive' | 'success' }) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border px-4 py-3 text-sm',
        variant === 'destructive' && 'border-destructive/40 bg-destructive/5 text-destructive',
        variant === 'success' &&
          'border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
        className,
      )}
      {...props}
    />
  );
}

export { Alert };
