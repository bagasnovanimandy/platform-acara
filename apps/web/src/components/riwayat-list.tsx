import { formatWaktu } from '@/lib/queries';
import type { AuditLog } from '@/lib/types';
import { cn } from '@/lib/utils';

export const AKSI_LABEL: Record<string, { label: string; tone: string }> = {
  CREATE: { label: 'Ditambahkan', tone: 'bg-emerald-500' },
  IMPORT: { label: 'Diimpor', tone: 'bg-emerald-500' },
  UPDATE: { label: 'Diubah', tone: 'bg-sky-500' },
  MUTASI: { label: 'Pindah kelompok', tone: 'bg-amber-500' },
  MUTASI_MASUK: { label: 'Anggota masuk', tone: 'bg-amber-500' },
  WALI: { label: 'Wali', tone: 'bg-violet-500' },
};

const FIELD_LABEL: Record<string, string> = {
  nama: 'Nama',
  jenisKelamin: 'Jenis kelamin',
  tanggalLahir: 'Tanggal lahir',
  noWa: 'No WA',
  status: 'Status',
  kategori: 'Kategori',
  fotoUrl: 'Foto',
  kode: 'Kode',
  warna: 'Warna',
  aktif: 'Aktif',
  role: 'Peran',
  scopes: 'Wilayah',
  password: 'Password',
};

function show(v: unknown): string {
  if (v == null || v === '') return '–';
  if (typeof v !== 'string') return String(v);
  if (v.startsWith('[')) {
    try {
      const arr = JSON.parse(v) as unknown[];
      return arr.length
        ? arr.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(', ')
        : '–';
    } catch {
      return v;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(v))
    return v.slice(0, 10).split('-').reverse().join('/');
  return v;
}

/** Perubahan `{ field: [sebelum, sesudah] }` dari AuditLog.data. */
function Perubahan({ data }: { data: Record<string, unknown> }) {
  const rows = Object.entries(data).filter(
    (e): e is [string, [unknown, unknown]] => Array.isArray(e[1]) && e[1].length === 2,
  );
  if (rows.length === 0) return null;
  return (
    <dl className="mt-2 grid gap-1 rounded-md bg-muted/60 p-2 text-xs">
      {rows.map(([field, [a, b]]) => (
        <div key={field} className="flex flex-wrap gap-x-2">
          <dt className="font-medium">{FIELD_LABEL[field] ?? field}</dt>
          <dd className="text-muted-foreground">
            <span className="line-through decoration-muted-foreground/50">{show(a)}</span>
            <span aria-hidden> → </span>
            <span className="text-foreground">{show(b)}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Garis waktu riwayat perubahan. */
export function RiwayatList({
  items,
  showEntitas = false,
}: {
  items: AuditLog[];
  showEntitas?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>;
  }
  return (
    <ol className="relative grid gap-5 border-l pl-5">
      {items.map((r) => {
        const aksi = AKSI_LABEL[r.aksi] ?? { label: r.aksi, tone: 'bg-slate-400' };
        return (
          <li key={r.id} className="relative">
            <span
              aria-hidden
              className={cn(
                'absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-background',
                aksi.tone,
              )}
            />
            <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium">{aksi.label}</span>
              {showEntitas && <span className="text-muted-foreground">· {r.entitas}</span>}
              <time className="ml-auto text-xs text-muted-foreground" dateTime={r.createdAt}>
                {formatWaktu(r.createdAt)}
              </time>
            </div>
            <p className="text-sm">{r.ringkasan}</p>
            <p className="text-xs text-muted-foreground">oleh {r.userNama}</p>
            {r.aksi === 'UPDATE' && r.data && <Perubahan data={r.data} />}
          </li>
        );
      })}
    </ol>
  );
}
