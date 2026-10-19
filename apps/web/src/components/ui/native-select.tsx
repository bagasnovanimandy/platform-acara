import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Select bawaan browser bergaya shadcn: ringan dan nyaman di HP. */
function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-base shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
