'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MessageCircle, Monitor, X } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage, wabotApi } from '@/lib/api';
import { canEdit, useAuth } from '@/lib/auth';
import {
  type Izin,
  nomorIzin,
  STATUS_IZIN,
  type StatusIzin,
  type StatusWa,
  useJumlahIzin,
} from '@/lib/izin';
import { formatWaktu } from '@/lib/queries';
import { STATUS_INFO } from '@/lib/rekap';
import type { Paginated } from '@/lib/types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const FILTER: { v: StatusIzin | ''; l: string }[] = [
  { v: 'SUBMITTED', l: 'Menunggu' },
  { v: 'APPROVED', l: 'Disetujui' },
  { v: 'REJECTED', l: 'Ditolak' },
  { v: '', l: 'Semua' },
];

export default function IzinPage() {
  const user = useAuth((s) => s.user);
  const [status, setStatus] = useState<StatusIzin | ''>('SUBMITTED');
  const [cari, setCari] = useState('');
  const [page, setPage] = useState(1);
  const menunggu = useJumlahIzin();
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (status) qs.set('status', status);
  if (cari.trim()) qs.set('q', cari.trim());
  const list = useQuery({
    queryKey: ['izin', 'list', qs.toString()],
    queryFn: () => wabotApi<Paginated<Izin>>(`/izin?${qs}`),
    placeholderData: keepPreviousData,
  });
  const wa = useQuery({
    queryKey: ['wa', 'status'],
    queryFn: () => wabotApi<StatusWa>('/wa/status'),
    enabled: canEdit(user),
    retry: false,
  });
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Izin</h1>
        <p className="text-sm text-muted-foreground">
          Pengajuan izin dan sakit dari bot WhatsApp. Yang disetujui langsung masuk rekap kehadiran.
          PJ izin juga bisa membalas SETUJU atau TOLAK langsung di WhatsApp.
        </p>
      </div>
      {wa.data && wa.data.keadaan !== 'TERHUBUNG' && (
        <Alert variant="destructive">
          Bot WhatsApp belum terhubung, jadi pengajuan baru tidak masuk.{' '}
          <Link href="/admin/wa" className="font-medium underline">
            Lihat status WhatsApp
          </Link>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border p-1" role="tablist" aria-label="Status izin">
          {FILTER.map((f) => (
            <button
              key={f.l}
              type="button"
              role="tab"
              aria-selected={status === f.v}
              onClick={() => {
                setStatus(f.v);
                setPage(1);
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm',
                status === f.v ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
              )}
            >
              {f.l}
              {f.v === 'SUBMITTED' && !!menunggu && (
                <span className="ml-1.5 tabular-nums" data-testid="jumlah-menunggu">
                  {menunggu}
                </span>
              )}
            </button>
          ))}
        </div>
        <Input
          aria-label="Cari izin"
          placeholder="Cari nama, kode, acara, atau IZ-0123…"
          value={cari}
          onChange={(e) => {
            setCari(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>

      {list.error && <Alert variant="destructive">{errorMessage(list.error)}</Alert>}
      {list.data?.items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {status === 'SUBMITTED' && !cari
            ? 'Tidak ada izin yang menunggu keputusan.'
            : 'Tidak ada izin yang cocok.'}
        </p>
      )}
      <div className="flex flex-col gap-3">
        {list.data?.items.map((i) => (
          <KartuIzin key={i.id} izin={i} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Sebelumnya
          </Button>
          <span className="tabular-nums">
            {page}/{totalPages}
          </span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Berikutnya
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: StatusIzin }) {
  return (
    <Badge
      variant={status === 'SUBMITTED' ? 'outline' : 'secondary'}
      className={cn(
        status === 'APPROVED' &&
          'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200',
        status === 'REJECTED' && 'bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-200',
      )}
    >
      {status === 'APPROVED' && <Check className="size-3" />}
      {status === 'REJECTED' && <X className="size-3" />}
      {STATUS_IZIN[status]}
    </Badge>
  );
}

function KartuIzin({ izin: i }: { izin: Izin }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tolak, setTolak] = useState(false);
  const [catatan, setCatatan] = useState('');
  const kat = STATUS_INFO[i.kategori];

  async function putuskan(status: 'APPROVED' | 'REJECTED', note?: string) {
    setBusy(true);
    setError(null);
    try {
      await wabotApi(`/izin/${i.id}/decide`, {
        method: 'POST',
        body: { status, ...(note ? { catatan: note } : {}) },
      });
      setTolak(false);
      await qc.invalidateQueries({ queryKey: ['izin'] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="py-4" data-testid="kartu-izin">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
          <div className="min-w-56 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/anggota/${i.anggotaId}`}
                className="text-lg font-semibold hover:underline"
              >
                {i.namaAnggota}
              </Link>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
                data-testid="kategori-izin"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: kat.color }}
                  aria-hidden
                />
                {kat.label}
              </span>
              <StatusBadge status={i.status} />
            </div>
            <div className="text-sm text-muted-foreground">
              {i.kodeAnggota} · {i.namaKelompok} · {i.namaDesa}
            </div>
          </div>
          <div className="text-sm text-muted-foreground sm:text-right">
            <div className="font-mono text-foreground">{nomorIzin(i.nomor)}</div>
            <div>Diajukan {formatWaktu(i.createdAt)}</div>
            <div>oleh {i.pengajuTipe === 'WALI' ? 'wali' : 'yang bersangkutan'}</div>
          </div>
        </div>

        <div className="text-sm">
          <Link
            href={`/admin/acara/${i.acaraId}?tab=rekap`}
            className="font-medium hover:underline"
          >
            {i.acaraNama}
          </Link>{' '}
          <span className="text-muted-foreground">
            · {i.sesiNama} · {formatWaktu(i.sesiMulai)}
          </span>
        </div>
        <blockquote className="border-l-2 pl-3 text-sm">{i.alasan}</blockquote>

        {i.status !== 'SUBMITTED' && i.decidedAt && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            {i.decidedVia === 'WA' ? (
              <MessageCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <Monitor className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <div>
              {STATUS_IZIN[i.status]} oleh {i.decidedByNama ?? '-'} lewat{' '}
              {i.decidedVia === 'WA' ? 'WhatsApp' : 'web'} · {formatWaktu(i.decidedAt)}
              {i.catatanPengurus && (
                <div className="text-foreground">Catatan: {i.catatanPengurus}</div>
              )}
            </div>
          </div>
        )}

        {error && !tolak && <Alert variant="destructive">{error}</Alert>}
        {i.bisaPutus && (
          <div className="flex flex-wrap gap-2">
            <Button size="lg" disabled={busy} onClick={() => void putuskan('APPROVED')}>
              <Check /> Setujui
            </Button>
            <Button size="lg" variant="outline" disabled={busy} onClick={() => setTolak(true)}>
              <X /> Tolak
            </Button>
          </div>
        )}
      </CardContent>

      {tolak && (
        <Dialog open onOpenChange={(o) => !o && setTolak(false)}>
          <DialogContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void putuskan('REJECTED', catatan.trim());
              }}
            >
              <DialogHeader>
                <DialogTitle>Tolak {nomorIzin(i.nomor)}?</DialogTitle>
                <DialogDescription>
                  {i.namaAnggota} tetap dihitung alpha bila tidak hadir. Catatan dikirim ke pengaju
                  lewat WhatsApp.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`catatan-${i.id}`}>Catatan (opsional)</Label>
                <Input
                  id={`catatan-${i.id}`}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  maxLength={300}
                  placeholder="mis. acara wajib hadir"
                  autoFocus
                />
              </div>
              {error && <Alert variant="destructive">{error}</Alert>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTolak(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="destructive" disabled={busy}>
                  {busy ? 'Menolak…' : 'Tolak izin'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
