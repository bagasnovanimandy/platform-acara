'use client';

import { animate, motion, useInView, useReducedMotion, type Variants } from 'motion/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

/** Bagian yang muncul saat di-scroll ke layar; anak `RevealItem` muncul bergiliran. */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : 'hidden'}
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={cn('min-w-0', className)} variants={item}>
      {children}
    </motion.div>
  );
}

/** Hook: true sekali elemen terlihat (atau langsung bila pengguna meminta gerak dikurangi). */
export function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  return { ref, seen: inView || reduce === true, reduce: reduce === true };
}

/** Angka yang menghitung naik saat terlihat. */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString('id-ID'),
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const { ref, seen, reduce } = useSeen<HTMLSpanElement>();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!seen) return;
    if (reduce) {
      setShown(value);
      return;
    }
    const c = animate(0, value, { duration: 1.1, ease: 'easeOut', onUpdate: setShown });
    return () => c.stop();
  }, [seen, reduce, value]);
  return (
    <span ref={ref} className="tabular-nums">
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
