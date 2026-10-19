'use client';

import { motion } from 'motion/react';
import { CountUp, useSeen } from './motion';

// Busur 270° (r = 48) dari kiri bawah, searah jarum jam, ke kanan bawah.
const ARC = 'M 26.06 93.94 A 48 48 0 1 1 93.94 93.94';

/** Gauge radial untuk rasio 0–1 (mis. kelengkapan data). */
export function Gauge({ value, label, hint }: { value: number; label: string; hint?: string }) {
  const { ref, seen, reduce } = useSeen<HTMLDivElement>();
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      ref={ref}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pct}%`}
      className="flex flex-col items-center gap-1 text-center"
      title={hint}
    >
      <div className="relative size-24 sm:size-36">
        <svg viewBox="0 0 120 120" className="size-full" aria-hidden>
          <path
            d={ARC}
            fill="none"
            stroke="var(--chart-track)"
            strokeWidth={10}
            strokeLinecap="round"
          />
          {pct > 0 && (
            <motion.path
              d={ARC}
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth={10}
              strokeLinecap="round"
              initial={{ pathLength: reduce ? pct / 100 : 0 }}
              animate={{ pathLength: seen ? pct / 100 : 0 }}
              transition={{ duration: reduce ? 0 : 1.2, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pt-1 text-xl font-semibold sm:text-2xl">
          <CountUp value={pct} format={(n) => `${Math.round(n)}%`} />
        </div>
      </div>
      <div className="-mt-2 text-xs font-medium sm:-mt-3 sm:text-sm">{label}</div>
      {hint && <div className="hidden max-w-44 text-xs text-muted-foreground sm:block">{hint}</div>}
    </div>
  );
}
