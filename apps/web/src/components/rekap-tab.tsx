'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Lock, Printer, RefreshCw, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AcaraDetail } from '@/lib/acara';
import { ACARA, acaraApi, apiBlob, errorMessage } from '@/lib/api';
import { canEdit, useAuth } from '@/lib/auth';
import { formatWaktu } from '@/lib/queries';
import {
  type BarisRekap,
  type FilterWilayah,
  persen,
  qsFilter,
  type RekapAcara,
  type RekapSesi,
  type Ringkasan,
  STATUS_INFO,
  STATUS_REKAP,
  type StatusRekap,
  type Wilayah,
} from '@/lib/rekap';
import { cn } from '@/lib/utils';

const SEMUA = '__semua__';
const METODE = { WAJAH: 'Wajah', MANUAL: 'Cari nama', TAMU: 'Tamu' } as const;

async function unduh(path: string, nama: string) {
  const blob = await apiBlob(path, ACARA);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  a.click();
  URL.revokeObjectURL(url);
}

export function StatusChip({ status }: { status: StatusRekap }) {
  const s = STATUS_INFO[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm" data-testid="status-rekap">
      <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
      {s.label}
    </span>
  );
}

/** Batang 100% hadir/izin/sakit/alpha (penanda saja; angka ada di sampingnya). */
export function BatangStatus({ r, className }: { r: Ringkasan; className?: string }) {
  if (!r.peserta) return null;
  return (
    <div
      className={cn('flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full', className)}
      role="img"
      aria-label={STATUS_REKAP.map((s) => `${STATUS_INFO[s].label} ${r[s]}`).join(', ')}
    >
      {STATUS_REKAP.filter((s) => r[s] > 0).map((s) => (
        <div
          key={s}
          title={`${STATUS_INFO[s].label}: ${r[s]}`}
          style={{ width: `${(r[s] / r.peserta) * 100}%`, background: STATUS_INFO[s].color }}
        />
      ))}
    </div>
  );
}

function Tiles({
  r,
  aktif,
  onPilih,
}: {
  r: Ringkasan;
  aktif?: StatusRekap | null;
  onPilih?: (s: StatusRekap | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Card className="gap-1 px-4 py-3">
        <div className="text-xs text-muted-foreground">Peserta</div>
        <div className="text-2xl font-semibold tabular-nums">
          {r.peserta.toLocaleString('id-ID')}
        </div>
        <div className="text-xs text-muted-foreground">{persen(r.persenHadir)} hadir</div>
      </Card>
      {STATUS_REKAP.map((s) => (
        <button
          key={s}
          type="button"
          disabled={!onPilih}
          aria-pressed={aktif === s}
          onClick={() => onPilih?.(aktif === s ? null : s)}
          className="rounded-xl border bg-card px-4 py-3 text-left shadow-xs transition-colors hover:bg-accent disabled:hover:bg-card aria-pressed:ring-2 aria-pressed:ring-ring"
          data-testid={`tile-${s}`}
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: STATUS_INFO[s].color }}
              aria-hidden
            />
            {STATUS_INFO[s].label}
          </div>
          <div className="text-2xl font-semibold tabular-nums">{r[s].toLocaleString('id-ID')}</div>
        </button>
      ))}
      <Card className="gap-1 px-4 py-3">
        <div className="text-xs text-muted-foreground">Terlambat</div>
        <div className="text-2xl font-semibold tabular-nums">{r.terlambat}</div>
        <div className="text-xs text-muted-foreground">dari yang hadir</div>
      </Card>
    </div>
  );
}

function PerKelompok({ rows }: { rows: (Ringkasan & Wilayah)[] }) {
  if (rows.length < 2) return null;
  return (
    <Card className="gap-3 py-4 print:break-inside-avoid">
      <CardHeader>
        <CardTitle>Per kelompok</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kelompok</TableHead>
              <TableHead className="w-1/3 min-w-32">Sebaran</TableHead>
              {STATUS_REKAP.map((s) => (
                <TableHead key={s} className="text-right">
                  {STATUS_INFO[s].label}
                </TableHead>
              ))}
              <TableHead className="text-right">% Hadir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="font-medium">{k.nama}</TableCell>
                <TableCell>
                  <BatangStatus r={k} />
                </TableCell>
                {STATUS_REKAP.map((s) => (
                  <TableCell key={s} className="text-right tabular-nums">
                    {k[s]}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium tabular-nums">
                  {persen(k.persenHadir)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function RekapTab({ acara }: { acara: AcaraDetail }) {
  const user = useAuth((s) => s.user);
  const bolehUbah = acara.bisaKelola && canEdit(user);
  const [sesiId, setSesiId] = useState(acara.sesi[0]?.id ?? SEMUA);
  const [wilayah, setWilayah] = useState('');
  const filter: FilterWilayah = wilayah.startsWith('d:')
    ? { desaId: wilayah.slice(2) }
    : wilayah.startsWith('k:')
      ? { kelompokId: wilayah.slice(2) }
      : {};
  const qs = qsFilter(filter);
  const semua = sesiId === SEMUA;
  const rSesi = useQuery({
    queryKey: ['rekap', 'sesi', sesiId, qs],
    queryFn: () => acaraApi<RekapSesi>(`/sesi/${sesiId}/rekap${qs}`),
    enabled: !semua,
    placeholderData: keepPreviousData,
  });
  const rAcara = useQuery({
    queryKey: ['rekap', 'acara', acara.id, qs],
    queryFn: () => acaraApi<RekapAcara>(`/acara/${acara.id}/rekap${qs}`),
    enabled: semua,
    placeholderData: keepPreviousData,
  });
  // Pilihan wilayah dari rekap tanpa filter (desa → kelompok).
  const opsi = useQuery({
    queryKey: ['rekap', 'acara', acara.id, ''],
    queryFn: () => acaraApi<RekapAcara>(`/acara/${acara.id}/rekap`),
  });
  const pilihanWilayah = useMemo(() => {
    const desa = new Map<string, { nama: string; kelompok: Map<string, string> }>();
    for (const a of opsi.data?.anggota ?? []) {
      const d = desa.get(a.anggota.desa.id) ?? { nama: a.anggota.desa.nama, kelompok: new Map() };
      d.kelompok.set(a.anggota.kelompok.id, a.anggota.kelompok.nama);
      desa.set(a.anggota.desa.id, d);
    }
    return [...desa.entries()].sort((a, b) => a[1].nama.localeCompare(b[1].nama, 'id'));
  }, [opsi.data]);

  if (acara.sesi.length === 0)
    return <p className="text-sm text-muted-foreground">Tambahkan sesi dulu.</p>;

  const labelWilayah =
    pilihanWilayah
      .flatMap(([id, d]) => [
        [`d:${id}`, d.nama] as const,
        ...[...d.kelompok].map(([k, n]) => [`k:${k}`, n] as const),
      ])
      .find(([v]) => v === wilayah)?.[1] ?? null;
  const sesiNama = acara.sesi.find((s) => s.id === sesiId)?.nama ?? 'semua-sesi';
  const error = semua ? rAcara.error : rSesi.error;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="flex flex-col gap-1 text-sm">
          Sesi
          <NativeSelect
            value={sesiId}
            onChange={(e) => setSesiId(e.target.value)}
            aria-label="Sesi rekap"
          >
            {acara.sesi.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))}
            <option value={SEMUA}>Semua sesi</option>
          </NativeSelect>
        </label>
        {pilihanWilayah.length > 0 && (
          <label className="flex flex-col gap-1 text-sm">
            Wilayah
            <NativeSelect
              value={wilayah}
              onChange={(e) => setWilayah(e.target.value)}
              aria-label="Wilayah rekap"
            >
              <option value="">Semua wilayah</option>
              {pilihanWilayah.map(([id, d]) => (
                <optgroup key={id} label={d.nama}>
                  <option value={`d:${id}`}>{d.nama} (semua kelompok)</option>
                  {[...d.kelompok]
                    .sort((a, b) => a[1].localeCompare(b[1], 'id'))
                    .map(([k, n]) => (
                      <option key={k} value={`k:${k}`}>
                        {n}
                      </option>
                    ))}
                </optgroup>
              ))}
            </NativeSelect>
          </label>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void unduh(
                semua ? `/acara/${acara.id}/rekap.xlsx${qs}` : `/sesi/${sesiId}/rekap.xlsx${qs}`,
                `rekap-${acara.nama}-${semua ? 'semua-sesi' : sesiNama}${labelWilayah ? `-${labelWilayah}` : ''}.xlsx`
                  .toLowerCase()
                  .replace(/[^a-z0-9.]+/g, '-'),
              )
            }
          >
            <Download /> Unduh Excel
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Cetak / PDF
          </Button>
        </div>
      </div>

      <div className="hidden print:block">
        <h2 className="text-xl font-semibold">
          Rekap {acara.nama} · {semua ? 'Semua sesi' : sesiNama}
        </h2>
        {labelWilayah && <p>{labelWilayah}</p>}
      </div>

      {error && <Alert variant="destructive">{errorMessage(error)}</Alert>}
      {semua
        ? rAcara.data && <RekapAcaraView r={rAcara.data} />
        : rSesi.data && <RekapSesiView r={rSesi.data} bolehUbah={bolehUbah} />}
    </div>
  );
}

const BATAS_BARIS = 100;

function RekapSesiView({ r, bolehUbah }: { r: RekapSesi; bolehUbah: boolean }) {
  const qc = useQueryClient();
  const [cari, setCari] = useState('');
  const [status, setStatus] = useState<StatusRekap | null>(null);
  const [semuaBaris, setSemuaBaris] = useState(false);
  const [dialog, setDialog] = useState<'tutup' | 'susulan' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sudahMulai = new Date(r.sesi.mulai) <= new Date();

  async function aksi(path: string, body?: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await acaraApi(`/sesi/${r.sesi.id}/${path}`, { method: 'POST', body: body ?? {} });
      setDialog(null);
      await qc.invalidateQueries({ queryKey: ['rekap'] });
      await qc.invalidateQueries({ queryKey: ['acara', r.acara.id] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const q = cari.trim().toLowerCase();
  const items = r.items.filter(
    (i) =>
      (!status || i.status === status) &&
      (!q || i.anggota.nama.toLowerCase().includes(q) || i.anggota.kode.toLowerCase().includes(q)),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {r.final ? (
          <Badge variant="secondary" className="gap-1" data-testid="status-final">
            <Lock className="size-3" /> Final · ditutup {formatWaktu(r.sesi.ditutupAt!)}
          </Badge>
        ) : (
          <Badge variant="outline" data-testid="status-final">
            Sementara · sesi belum ditutup
          </Badge>
        )}
        {r.final && r.dihitungAt && (
          <span className="text-xs text-muted-foreground">
            Dihitung {formatWaktu(r.dihitungAt)}
          </span>
        )}
        {bolehUbah && (
          <div className="ml-auto flex flex-wrap gap-2 print:hidden">
            {sudahMulai && (
              <Button variant="outline" onClick={() => setDialog('susulan')}>
                <UserCheck /> Absen susulan
              </Button>
            )}
            {r.final ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void aksi('rekap/hitung-ulang')}
              >
                <RefreshCw /> Hitung ulang
              </Button>
            ) : (
              sudahMulai && (
                <Button onClick={() => setDialog('tutup')}>
                  <Lock /> Tutup sesi
                </Button>
              )
            )}
          </div>
        )}
      </div>
      {error && !dialog && <Alert variant="destructive">{error}</Alert>}

      <Tiles r={r.ringkas} aktif={status} onPilih={setStatus} />
      <PerKelompok rows={r.perKelompok} />

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Input
          aria-label="Cari peserta di rekap"
          placeholder="Cari nama atau kode…"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-sm text-muted-foreground">
          {items.length} dari {r.items.length} peserta
          {status && ` · ${STATUS_INFO[status].label}`}
        </span>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">No</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Waktu</TableHead>
              <TableHead>Cara</TableHead>
              <TableHead>Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i, n) => (
              <BarisTabel
                key={i.anggota.id}
                i={i}
                no={n + 1}
                // Layar dibatasi agar ringan; cetak tetap memuat semua baris.
                className={!semuaBaris && n >= BATAS_BARIS ? 'hidden print:table-row' : undefined}
              />
            ))}
          </TableBody>
        </Table>
        {!semuaBaris && items.length > BATAS_BARIS && (
          <div className="border-t p-3 text-center print:hidden">
            <Button variant="ghost" onClick={() => setSemuaBaris(true)}>
              Tampilkan semua {items.length} peserta
            </Button>
          </div>
        )}
        {items.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Tidak ada peserta yang cocok.</p>
        )}
      </Card>

      {dialog === 'tutup' && (
        <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tutup {r.sesi.nama}?</DialogTitle>
              <DialogDescription>
                Daftar peserta dikunci dan status final dihitung: {r.ringkas.HADIR} hadir,{' '}
                {r.ringkas.IZIN} izin, {r.ringkas.SAKIT} sakit, {r.ringkas.ALPHA} alpha. Absensi
                yang masih terkirim dari pintu, absen susulan, dan izin yang diputuskan belakangan
                tetap ikut dihitung.
              </DialogDescription>
            </DialogHeader>
            {error && <Alert variant="destructive">{error}</Alert>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>
                Batal
              </Button>
              <Button disabled={busy} onClick={() => void aksi('tutup')}>
                {busy ? 'Menutup…' : 'Tutup sesi'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {dialog === 'susulan' && (
        <SusulanDialog
          rows={r.items.filter((i) => i.status !== 'HADIR')}
          busy={busy}
          error={error}
          onClose={() => setDialog(null)}
          onPilih={(anggotaId, catatan) => void aksi('absensi', { anggotaId, catatan })}
        />
      )}
    </>
  );
}

function BarisTabel({ i, no, className }: { i: BarisRekap; no: number; className?: string }) {
  return (
    <TableRow
      className={cn(i.wajahPending && 'bg-amber-50 dark:bg-amber-500/10', className)}
      data-testid="baris-rekap"
    >
      <TableCell className="text-muted-foreground tabular-nums">{no}</TableCell>
      <TableCell>
        <div className="font-medium">{i.anggota.nama}</div>
        <div className="text-xs text-muted-foreground">
          {i.anggota.kode} · {i.anggota.kelompok.nama}
        </div>
      </TableCell>
      <TableCell>
        <StatusChip status={i.status} />
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">
        {i.waktu ? formatWaktu(i.waktu) : '-'}
        {i.terlambat && (
          <Badge variant="outline" className="ml-2">
            Terlambat
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {i.susulan ? 'Susulan' : i.metode ? METODE[i.metode] : i.izin ? 'Izin disetujui' : '-'}
        {i.pintu && ` · ${i.pintu}`}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {i.wajahPending && (
            <Badge className="border-transparent bg-amber-400 text-black">
              Wajah belum diverifikasi
            </Badge>
          )}
          {i.perluTinjau && <Badge variant="outline">Perlu ditinjau</Badge>}
          {i.susulan && <Badge variant="secondary">Dicatat admin</Badge>}
        </div>
      </TableCell>
    </TableRow>
  );
}

function SusulanDialog({
  rows,
  busy,
  error,
  onClose,
  onPilih,
}: {
  rows: BarisRekap[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onPilih: (anggotaId: string, catatan: string) => void;
}) {
  const [cari, setCari] = useState('');
  const [catatan, setCatatan] = useState('');
  const q = cari.trim().toLowerCase();
  const hasil = q
    ? rows.filter(
        (i) => i.anggota.nama.toLowerCase().includes(q) || i.anggota.kode.toLowerCase().includes(q),
      )
    : rows;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Absen susulan</DialogTitle>
          <DialogDescription>
            Untuk peserta yang hadir tetapi tidak tercatat di pintu. Waktu hadir dicatat sama dengan
            jam mulai sesi.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Cari peserta susulan"
          placeholder="Cari nama atau kode…"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          autoFocus
        />
        <Input
          aria-label="Catatan susulan"
          placeholder="Catatan (opsional), mis. lupa scan"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          maxLength={300}
        />
        <ul className="max-h-72 overflow-y-auto rounded-md border">
          {hasil.slice(0, 50).map((i) => (
            <li key={i.anggota.id} className="border-b last:border-0">
              <button
                type="button"
                disabled={busy}
                onClick={() => onPilih(i.anggota.id, catatan.trim())}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{i.anggota.nama}</span>
                  <span className="block text-xs text-muted-foreground">
                    {i.anggota.kode} · {i.anggota.kelompok.nama}
                  </span>
                </span>
                <StatusChip status={i.status} />
              </button>
            </li>
          ))}
          {hasil.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">Tidak ditemukan</li>
          )}
        </ul>
        {error && <Alert variant="destructive">{error}</Alert>}
      </DialogContent>
    </Dialog>
  );
}

function RekapAcaraView({ r }: { r: RekapAcara }) {
  const [cari, setCari] = useState('');
  const [semuaBaris, setSemuaBaris] = useState(false);
  const q = cari.trim().toLowerCase();
  const rows = r.anggota.filter(
    (a) =>
      !q || a.anggota.nama.toLowerCase().includes(q) || a.anggota.kode.toLowerCase().includes(q),
  );
  return (
    <>
      <Tiles r={r.ringkas} />
      <p className="text-sm text-muted-foreground">
        Angka di atas menjumlahkan kehadiran semua sesi ({r.sesi.length} sesi).
        {r.sesi.some((s) => !s.final) &&
          ' Sesi bertanda * belum ditutup; statusnya masih sementara.'}
      </p>
      <PerKelompok rows={r.perKelompok} />
      <Input
        aria-label="Cari peserta di rekap"
        placeholder="Cari nama atau kode…"
        value={cari}
        onChange={(e) => setCari(e.target.value)}
        className="max-w-xs print:hidden"
      />
      <Card className="overflow-x-auto py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              {r.sesi.map((s) => (
                <TableHead key={s.id} className="text-center whitespace-nowrap">
                  {s.nama}
                  {!s.final && ' *'}
                </TableHead>
              ))}
              <TableHead className="text-right">% Hadir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a, n) => (
              <TableRow
                key={a.anggota.id}
                data-testid="baris-matriks"
                className={!semuaBaris && n >= BATAS_BARIS ? 'hidden print:table-row' : undefined}
              >
                <TableCell>
                  <div className="font-medium">{a.anggota.nama}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.anggota.kode} · {a.anggota.kelompok.nama}
                  </div>
                </TableCell>
                {a.status.map((s, i) => (
                  <TableCell key={r.sesi[i]!.id} className="text-center">
                    {s ? (
                      <span
                        className="inline-flex size-7 items-center justify-center rounded-md border text-xs font-semibold"
                        style={{ borderColor: STATUS_INFO[s].color }}
                        title={STATUS_INFO[s].label}
                      >
                        {STATUS_INFO[s].singkat}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">·</span>
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium tabular-nums">
                  {persen(a.ringkas.persenHadir)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!semuaBaris && rows.length > BATAS_BARIS && (
          <div className="border-t p-3 text-center print:hidden">
            <Button variant="ghost" onClick={() => setSemuaBaris(true)}>
              Tampilkan semua {rows.length} peserta
            </Button>
          </div>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">H = hadir, I = izin, S = sakit, A = alpha.</p>
    </>
  );
}
