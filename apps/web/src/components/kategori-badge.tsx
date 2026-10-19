import { KATEGORI_GENERUS_LABEL, type KategoriGenerus } from '@platform-acara/shared';
import { cn } from '@/lib/utils';

/** Warna tetap per kategori supaya mudah dikenali sekilas di tabel. */
export const KATEGORI_TONE: Record<KategoriGenerus, string> = {
  CABERAWIT: 'bg-amber-100 text-amber-900 ring-amber-300',
  PRAREMAJA: 'bg-sky-100 text-sky-900 ring-sky-300',
  REMAJA: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  USIA_NIKAH: 'bg-violet-100 text-violet-900 ring-violet-300',
};

export function KategoriBadge({ kategori }: { kategori: KategoriGenerus | null }) {
  if (!kategori) {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
        Belum diisi
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        KATEGORI_TONE[kategori],
      )}
    >
      {KATEGORI_GENERUS_LABEL[kategori]}
    </span>
  );
}
