import type { KategoriWarna } from '@platform-acara/shared/kategori';
import { cn } from '@/lib/utils';
import type { KategoriRef } from '@/lib/types';

/** Kelas warna per palet (ditulis lengkap supaya terbaca Tailwind). */
export const KATEGORI_TONE: Record<KategoriWarna, { chip: string; dot: string }> = {
  slate: { chip: 'bg-slate-100 text-slate-800 ring-slate-300', dot: 'bg-slate-500' },
  amber: { chip: 'bg-amber-100 text-amber-900 ring-amber-300', dot: 'bg-amber-500' },
  sky: { chip: 'bg-sky-100 text-sky-900 ring-sky-300', dot: 'bg-sky-500' },
  emerald: { chip: 'bg-emerald-100 text-emerald-900 ring-emerald-300', dot: 'bg-emerald-500' },
  violet: { chip: 'bg-violet-100 text-violet-900 ring-violet-300', dot: 'bg-violet-500' },
  indigo: { chip: 'bg-indigo-100 text-indigo-900 ring-indigo-300', dot: 'bg-indigo-500' },
  teal: { chip: 'bg-teal-100 text-teal-900 ring-teal-300', dot: 'bg-teal-500' },
  stone: { chip: 'bg-stone-200 text-stone-800 ring-stone-400', dot: 'bg-stone-500' },
  rose: { chip: 'bg-rose-100 text-rose-900 ring-rose-300', dot: 'bg-rose-500' },
  cyan: { chip: 'bg-cyan-100 text-cyan-900 ring-cyan-300', dot: 'bg-cyan-500' },
  lime: { chip: 'bg-lime-100 text-lime-900 ring-lime-300', dot: 'bg-lime-600' },
  orange: { chip: 'bg-orange-100 text-orange-900 ring-orange-300', dot: 'bg-orange-500' },
  fuchsia: { chip: 'bg-fuchsia-100 text-fuchsia-900 ring-fuchsia-300', dot: 'bg-fuchsia-500' },
};

export function KategoriChip({
  kategori,
  className,
}: {
  kategori: KategoriRef;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        KATEGORI_TONE[kategori.warna]?.chip ?? KATEGORI_TONE.slate.chip,
        className,
      )}
    >
      {kategori.nama}
    </span>
  );
}

export function KategoriList({ kategori }: { kategori: KategoriRef[] }) {
  if (kategori.length === 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
        Belum diisi
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {kategori.map((k) => (
        <KategoriChip key={k.id} kategori={k} />
      ))}
    </span>
  );
}
