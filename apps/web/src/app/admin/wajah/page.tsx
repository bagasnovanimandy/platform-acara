'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ScanFace, UserRoundCog, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { AuthImage } from '@/components/auth-image';
import { CariAnggota } from '@/components/cari-anggota';
import { Alert } from '@/components/ui/alert';
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
import type { AnggotaRingkas } from '@/lib/acara';
import { acaraApi, errorMessage } from '@/lib/api';
import { canEdit, useAuth } from '@/lib/auth';
import { formatWaktu } from '@/lib/queries';
import type { Paginated } from '@/lib/types';
import { thumbPath, useJumlahWajahPending, type WajahDetail, type WajahRingkas } from '@/lib/wajah';

const PAGE_SIZE = 10;

export default function VerifikasiWajahPage() {
  const user = useAuth((s) => s.user);
  const [page, setPage] = useState(1);
  const jumlah = useJumlahWajahPending();
  const list = useQuery({
    queryKey: ['wajah-pending', page, jumlah],
    queryFn: () =>
      acaraApi<Paginated<WajahRingkas>>(`/face/pending?page=${page}&pageSize=${PAGE_SIZE}`),
    placeholderData: keepPreviousData,
  });
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Verifikasi wajah</h1>
        <p className="text-sm text-muted-foreground" data-testid="ringkas-wajah">
          {list.data
            ? list.data.total === 0
              ? 'Tidak ada wajah yang perlu diverifikasi.'
              : `${list.data.total} wajah perlu verifikasi. Wajah ini sudah dipakai di pintu sambil menunggu.`
            : 'Memuat…'}
        </p>
      </div>
      {list.error && <Alert variant="destructive">{errorMessage(list.error)}</Alert>}
      {list.data?.items.map((w) => (
        <KartuWajah key={w.id} wajah={w} bolehUbah={canEdit(user)} />
      ))}
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

function KartuWajah({ wajah: w, bolehUbah }: { wajah: WajahRingkas; bolehUbah: boolean }) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ['wajah', w.id],
    queryFn: () => acaraApi<WajahDetail>(`/face/${w.id}`),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'tolak' | 'ganti' | null>(null);

  async function aksi(path: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      await acaraApi(`/face/${w.id}/${path}`, { method: 'POST', body });
      setDialog(null);
      await qc.invalidateQueries({ queryKey: ['wajah-pending'] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const sebelumnya = detail.data?.sebelumnya ?? [];
  return (
    <Card className="py-4" data-testid="kartu-wajah">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-1">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold">{w.anggota.nama}</div>
            <div className="text-sm text-muted-foreground">
              {w.anggota.kode} · {w.anggota.namaKelompok} · {w.anggota.namaDesa}
            </div>
          </div>
          <div className="text-sm text-muted-foreground sm:text-right">
            <div>
              {w.pintu ?? 'Admin'}
              {w.sesi && ` · ${w.sesi.acara} (${w.sesi.nama})`}
            </div>
            <div>{formatWaktu(w.createdAt)}</div>
          </div>
        </div>

        <div className="grid max-w-3xl grid-cols-5 gap-2">
          {Array.from({ length: w.jumlahThumbnail }, (_, i) => (
            <figure key={i} className="flex flex-col gap-1">
              <AuthImage
                path={thumbPath(w.id, i)}
                alt={`${w.anggota.nama} pose ${w.pose[i] ?? i + 1}`}
                className="rounded-md"
              />
              <figcaption className="text-center text-xs text-muted-foreground">
                {w.pose[i]}
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-sm font-medium">Wajah terverifikasi sebelumnya</div>
          {sebelumnya.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {detail.isLoading ? 'Memuat…' : 'Belum ada. Ini wajah pertama anggota ini.'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sebelumnya.map((s) => (
                <figure key={s.id} className="w-20">
                  <AuthImage
                    path={thumbPath(s.id, 0)}
                    alt="Wajah terverifikasi"
                    className="rounded-md"
                  />
                  <figcaption className="text-center text-xs text-muted-foreground">
                    {s.verifiedAt ? formatWaktu(s.verifiedAt) : '-'}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          {!!detail.data?.absensi && (
            <p className="text-sm text-muted-foreground">
              Sudah dipakai untuk {detail.data.absensi} absensi.
            </p>
          )}
        </div>

        {error && <Alert variant="destructive">{error}</Alert>}
        {bolehUbah && (
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void aksi('verify')}>
              <Check /> Setujui
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setDialog('tolak')}>
              <X /> Tolak
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setDialog('ganti')}>
              <UserRoundCog /> Ganti anggota
            </Button>
          </div>
        )}
      </CardContent>
      {dialog === 'tolak' && (
        <TolakDialog
          nama={w.anggota.nama}
          busy={busy}
          error={error}
          onClose={() => setDialog(null)}
          onTolak={(alasan) => void aksi('reject', { alasan })}
        />
      )}
      {dialog === 'ganti' && (
        <GantiDialog
          nama={w.anggota.nama}
          busy={busy}
          error={error}
          onClose={() => setDialog(null)}
          onPilih={(a) => void aksi('reassign', { anggotaId: a.id })}
        />
      )}
    </Card>
  );
}

function TolakDialog({
  nama,
  busy,
  error,
  onClose,
  onTolak,
}: {
  nama: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onTolak: (alasan: string) => void;
}) {
  const [alasan, setAlasan] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onTolak(alasan.trim());
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Tolak wajah {nama}?</DialogTitle>
            <DialogDescription>
              Wajah ini tidak dipakai lagi di pintu dan fotonya dihapus. Absensi yang memakai wajah
              ini ditandai perlu ditinjau.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="alasan-tolak">Alasan (opsional)</Label>
            <Input
              id="alasan-tolak"
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="mis. foto buram, bukan orangnya"
              maxLength={300}
            />
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? 'Menolak…' : 'Tolak wajah'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GantiDialog({
  nama,
  busy,
  error,
  onClose,
  onPilih,
}: {
  nama: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onPilih: (a: AnggotaRingkas) => void;
}) {
  const [pilih, setPilih] = useState<AnggotaRingkas | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ganti anggota</DialogTitle>
          <DialogDescription>
            Wajah ini tercatat sebagai {nama}. Pilih anggota yang benar; wajah langsung disetujui
            untuk anggota itu dan absensi yang memakainya ditandai perlu ditinjau.
          </DialogDescription>
        </DialogHeader>
        {pilih ? (
          <div className="flex items-center gap-3 rounded-md border p-3">
            <ScanFace className="size-5 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{pilih.nama}</div>
              <div className="text-xs text-muted-foreground">
                {pilih.kode} · {pilih.namaKelompok}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPilih(null)}>
              Ubah
            </Button>
          </div>
        ) : (
          <CariAnggota onPick={setPilih} label="Cari anggota yang benar" className="h-9" />
        )}
        {error && <Alert variant="destructive">{error}</Alert>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={!pilih || busy} onClick={() => pilih && onPilih(pilih)}>
            {busy ? 'Menyimpan…' : 'Pindahkan & setujui'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
