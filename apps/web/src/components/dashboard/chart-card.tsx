'use client';

import { type ReactNode, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CountUp } from './motion';

export interface TableData {
  head: string[];
  rows: (string | number)[][];
}

/** Kartu grafik dengan tombol "Tabel" agar data juga terbaca tanpa grafik. */
export function ChartCard({
  title,
  description,
  table,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  table?: TableData;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={cn('h-full gap-4', className)}>
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {table && (
            <button
              type="button"
              aria-pressed={asTable}
              onClick={() => setAsTable((v) => !v)}
              className="rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent aria-pressed:bg-accent aria-pressed:text-foreground"
            >
              Tabel
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {asTable && table ? (
          <div className="max-h-80 overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left">
                <tr>
                  {table.head.map((h, i) => (
                    <th key={h} className={cn('px-3 py-2 font-medium', i > 0 && 'text-right')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, ri) => (
                  <tr key={ri} className="border-t">
                    {r.map((c, i) => (
                      <td key={i} className={cn('px-3 py-1.5', i > 0 && 'text-right tabular-nums')}>
                        {typeof c === 'number' ? c.toLocaleString('id-ID') : c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/** Angka utama (KPI) dengan hitung naik. */
export function StatTile({
  label,
  value,
  hint,
  format,
}: {
  label: string;
  value: number;
  hint?: ReactNode;
  format?: (n: number) => string;
}) {
  return (
    <Card className="h-full gap-1 px-5 py-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold">
        <CountUp value={value} format={format} />
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

/** Tooltip grafik: teks memakai tinta biasa, warna hanya pada penanda. */
export function TooltipBox({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; color?: string }[];
}) {
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          {r.color && (
            <span className="size-2.5 rounded-sm" style={{ background: r.color }} aria-hidden />
          )}
          <span className="text-muted-foreground">{r.label}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums">
            {r.value.toLocaleString('id-ID')}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Legenda HTML sederhana (selalu ada untuk ≥ 2 seri). */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export const AXIS = {
  tick: { fill: 'var(--chart-axis)', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: 'var(--chart-grid)' },
} as const;
