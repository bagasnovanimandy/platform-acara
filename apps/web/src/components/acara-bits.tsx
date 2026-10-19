import {
  type StatusAcara,
  STATUS_LABEL,
  STATUS_TONE,
  TINGKAT_LABEL,
  type Tingkat,
} from '@/lib/acara';
import { cn } from '@/lib/utils';

export function StatusChip({ status, className }: { status: StatusAcara; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        STATUS_TONE[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function TingkatChip({ tingkat }: { tingkat: Tingkat }) {
  return (
    <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs whitespace-nowrap text-muted-foreground">
      {TINGKAT_LABEL[tingkat]}
    </span>
  );
}
