'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, List, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { StatusChip, TingkatChip } from '@/components/acara-bits';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { type Acara, formatJam, STATUS_LABEL, tanggalWib, TINGKAT_LABEL } from '@/lib/acara';
import { acaraApi, errorMessage } from '@/lib/api';
import { canEdit, useAuth } from '@/lib/auth';
import type { Paginated } from '@/lib/types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const tanggalPanjang = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso));

export default function AcaraListPage() {
  const user = useAuth((s) => s.user);
  const [view, setView] = useState<'daftar' | 'kalender'>('daftar');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [tingkat, setTingkat] = useState('');
  const search = useDebounced(q, 300);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Acara</h1>
        <div className="inline-flex rounded-lg border p-1" role="tablist" aria-label="Tampilan">
          {(
            [
              ['daftar', 'Daftar', List],
              ['kalender', 'Kalender', CalendarDays],
            ] as const
          ).map(([v, l, Icon]) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm',
                view === v ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {l}
            </button>
          ))}
        </div>
        {canEdit(user) && (
          <Button asChild className="ml-auto">
            <Link href="/admin/acara/baru">Buat acara</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="q">Cari</Label>
          <Input id="q" placeholder="Nama acara" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <NativeSelect id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tingkat">Tingkat</Label>
          <NativeSelect id="tingkat" value={tingkat} onChange={(e) => setTingkat(e.target.value)}>
            <option value="">Semua</option>
            {Object.entries(TINGKAT_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {view === 'daftar' ? (
        <Daftar filter={{ q: search, status, tingkat }} />
      ) : (
        <Kalender filter={{ q: search, status, tingkat }} />
      )}
    </div>
  );
}

type Filter = { q: string; status: string; tingkat: string };

function filterParams(f: Filter, extra: Record<string, string>) {
  const p = new URLSearchParams(extra);
  if (f.q) p.set('q', f.q);
  if (f.status) p.set('status', f.status);
  if (f.tingkat) p.set('tingkat', f.tingkat);
  return p.toString();
}

function Daftar({ filter }: { filter: Filter }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [filter.q, filter.status, filter.tingkat]);
  const qs = filterParams(filter, { page: String(page), pageSize: String(PAGE_SIZE) });
  const list = useQuery({
    queryKey: ['acara', 'list', qs],
    queryFn: () => acaraApi<Paginated<Acara>>(`/acara?${qs}`),
    placeholderData: keepPreviousData,
  });
  if (list.error) return <Alert variant="destructive">{errorMessage(list.error)}</Alert>;
  if (!list.data) return <p className="text-muted-foreground">Memuat…</p>;
  const totalPages = Math.max(1, Math.ceil(list.data.total / PAGE_SIZE));
  if (list.data.items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        Belum ada acara.
      </div>
    );
  }
  return (
    <>
      <ul className="grid gap-3">
        {list.data.items.map((a) => (
          <li key={a.id}>
            <Link
              href={`/admin/acara/${a.id}`}
              className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div className="grid w-14 shrink-0 place-items-center rounded-lg bg-muted py-1.5 text-center">
                <span className="text-xs text-muted-foreground uppercase">
                  {new Intl.DateTimeFormat('id-ID', {
                    month: 'short',
                    timeZone: 'Asia/Jakarta',
                  }).format(new Date(a.tanggalMulai))}
                </span>
                <span className="text-xl leading-none font-semibold">
                  {tanggalWib(a.tanggalMulai).slice(8)}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.nama}</span>
                  <StatusChip status={a.status} />
                  <TingkatChip tingkat={a.tingkat} />
                </div>
                <div className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                  <span>
                    {tanggalPanjang(a.tanggalMulai)}, {formatJam(a.tanggalMulai)} WIB
                  </span>
                  {a.lokasi && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden />
                      {a.lokasi}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div>{a.wilayah.map((w) => w.nama).join(', ')}</div>
                <div className="text-xs">{a._count?.sesi ?? 0} sesi</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Sebelumnya
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Berikutnya
          </Button>
        </div>
      )}
    </>
  );
}

function Kalender({ filter }: { filter: Filter }) {
  const now = new Date(Date.now() + 7 * 3600_000);
  const [bulan, setBulan] = useState({ y: now.getUTCFullYear(), m: now.getUTCMonth() });
  // Grid Senin–Minggu yang mencakup seluruh bulan.
  const hari = useMemo(() => {
    const first = new Date(Date.UTC(bulan.y, bulan.m, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    const start = new Date(first.getTime() - offset * 864e5);
    const last = new Date(Date.UTC(bulan.y, bulan.m + 1, 0));
    const weeks = Math.ceil((offset + last.getUTCDate()) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) =>
      new Date(start.getTime() + i * 864e5).toISOString().slice(0, 10),
    );
  }, [bulan]);
  const dari = `${hari[0]}T00:00:00+07:00`;
  const sampai = `${hari[hari.length - 1]}T23:59:59+07:00`;
  const qs = filterParams(filter, { dari, sampai, pageSize: '100' });
  const list = useQuery({
    queryKey: ['acara', 'kalender', qs],
    queryFn: () => acaraApi<Paginated<Acara>>(`/acara?${qs}`),
    placeholderData: keepPreviousData,
  });
  const perHari = useMemo(() => {
    const m = new Map<string, Acara[]>();
    for (const a of list.data?.items ?? []) {
      // Acara beberapa hari tampil di setiap harinya.
      const s = tanggalWib(a.tanggalMulai);
      const e = tanggalWib(a.tanggalSelesai);
      for (const d of hari) if (d >= s && d <= e) m.set(d, [...(m.get(d) ?? []), a]);
    }
    for (const v of m.values()) v.sort((a, b) => a.tanggalMulai.localeCompare(b.tanggalMulai));
    return m;
  }, [list.data, hari]);
  const today = now.toISOString().slice(0, 10);
  const label = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(bulan.y, bulan.m, 1)));
  const geser = (n: number) =>
    setBulan(({ y, m }) => ({ y: y + Math.floor((m + n) / 12), m: (((m + n) % 12) + 12) % 12 }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => geser(-1)}
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => geser(1)}
          aria-label="Bulan berikutnya"
        >
          <ChevronRight />
        </Button>
        <h2 className="text-lg font-semibold capitalize">{label}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setBulan({ y: now.getUTCFullYear(), m: now.getUTCMonth() })}
        >
          Hari ini
        </Button>
      </div>
      {list.error && <Alert variant="destructive">{errorMessage(list.error)}</Alert>}
      <div className="overflow-x-auto">
        <div className="grid min-w-[44rem] grid-cols-7 overflow-hidden rounded-xl border bg-border gap-px">
          {HARI.map((h) => (
            <div key={h} className="bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {h}
            </div>
          ))}
          {hari.map((d) => {
            const inMonth = Number(d.slice(5, 7)) - 1 === bulan.m;
            const items = perHari.get(d) ?? [];
            return (
              <div
                key={d}
                className={cn(
                  'flex min-h-24 flex-col gap-1 bg-background p-1.5',
                  !inMonth && 'bg-muted/40',
                )}
              >
                <span
                  className={cn(
                    'grid size-6 place-items-center rounded-full text-xs',
                    !inMonth && 'text-muted-foreground',
                    d === today && 'bg-primary font-semibold text-primary-foreground',
                  )}
                >
                  {Number(d.slice(8))}
                </span>
                {items.slice(0, 3).map((a) => (
                  <Link
                    key={a.id}
                    href={`/admin/acara/${a.id}`}
                    title={a.nama}
                    className="truncate rounded bg-primary/10 px-1.5 py-0.5 text-xs hover:bg-primary/20"
                  >
                    <span className="tabular-nums text-muted-foreground">
                      {formatJam(a.tanggalMulai)}
                    </span>{' '}
                    {a.nama}
                  </Link>
                ))}
                {items.length > 3 && (
                  <span className="px-1.5 text-xs text-muted-foreground">
                    +{items.length - 3} lagi
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
