'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ImagePlus, MapPin, Printer, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, use, useEffect, useState } from 'react';
import { StatusChip, TingkatChip } from '@/components/acara-bits';
import { AuthImage } from '@/components/auth-image';
import { KategoriChip } from '@/components/kategori-badge';
import { KehadiranTab } from '@/components/kehadiran-tab';
import { PintuTab } from '@/components/pintu-tab';
import { SesiEditor } from '@/components/sesi-editor';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  type AcaraDetail,
  type Foto,
  formatRentang,
  PERAN_PJ_LABEL,
  type PeranPJ,
  type Peserta,
  useAcara,
} from '@/lib/acara';
import { acaraApi, api, errorMessage } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/auth';
import { useKategori } from '@/lib/queries';
import type { Kategori, Paginated, UserRow } from '@/lib/types';
import { cn } from '@/lib/utils';

const TABS = [
  ['sesi', 'Sesi & rundown'],
  ['pintu', 'Pintu'],
  ['kehadiran', 'Kehadiran'],
  ['peserta', 'Peserta'],
  ['pj', 'Penanggung jawab'],
  ['foto', 'Foto'],
] as const;
type Tab = (typeof TABS)[number][0];

export default function AcaraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const acara = useAcara(id);
  const kategori = useKategori();
  const [tab, setTab] = useState<Tab>('sesi');

  if (acara.error) return <Alert variant="destructive">{errorMessage(acara.error)}</Alert>;
  const a = acara.data;
  if (!a) return <p className="text-muted-foreground">Memuat…</p>;
  const byKode = new Map((kategori.data?.items ?? []).map((k) => [k.kode, k]));

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-muted-foreground">
        <Link href="/admin/acara" className="hover:underline">
          Acara
        </Link>{' '}
        / {a.nama}
      </nav>

      <section className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{a.nama}</h1>
            <StatusChip status={a.status} />
            <TingkatChip tingkat={a.tingkat} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" aria-hidden />
              {formatRentang(a.tanggalMulai, a.tanggalSelesai)}
            </span>
            {a.lokasi && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {a.lokasi}
              </span>
            )}
          </div>
          {a.deskripsi && <p className="max-w-2xl text-sm">{a.deskripsi}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/acara/${id}/cetak`} target="_blank">
              <Printer /> Cetak rundown
            </Link>
          </Button>
          {a.bisaKelola && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/admin/acara/${id}/ubah`}>Ubah</Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Hapus acara"
                onClick={async () => {
                  if (!confirm(`Hapus acara "${a.nama}"?`)) return;
                  await acaraApi(`/acara/${id}`, { method: 'DELETE' });
                  await qc.invalidateQueries({ queryKey: ['acara'] });
                  router.push('/admin/acara');
                }}
              >
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="gap-1 py-4">
          <CardContent className="flex items-center gap-3">
            <Users className="size-5 text-muted-foreground" aria-hidden />
            <div>
              <div className="text-2xl font-semibold tabular-nums">
                {a.jumlahPeserta.toLocaleString('id-ID')}
              </div>
              <div className="text-xs text-muted-foreground">
                peserta
                {a.jenisKelamin && ` · ${a.jenisKelamin === 'L' ? 'laki-laki' : 'perempuan'}`}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardContent>
            <div className="text-xs text-muted-foreground">Wilayah</div>
            <div className="text-sm font-medium">{a.wilayah.map((w) => w.nama).join(', ')}</div>
            <div className="text-xs text-muted-foreground">
              Penyelenggara: {a.penyelenggaraNama}
            </div>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardContent className="flex flex-col gap-1.5">
            <div className="text-xs text-muted-foreground">Kategori</div>
            <div className="flex flex-wrap gap-1">
              {a.kategori.length === 0 ? (
                <span className="text-sm font-medium">Semua kategori</span>
              ) : (
                a.kategori.map((k) => {
                  const ref = byKode.get(k);
                  return ref ? (
                    <KategoriChip key={k} kategori={ref} />
                  ) : (
                    <span key={k} className="text-xs">
                      {k}
                    </span>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div role="tablist" className="flex gap-1 overflow-x-auto border-b">
        {TABS.map(([v, l]) => (
          <button
            key={v}
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap',
              tab === v
                ? 'border-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {l}
            {v === 'sesi' && ` (${a.sesi.length})`}
            {v === 'pj' && ` (${a.pj.length})`}
          </button>
        ))}
      </div>

      {tab === 'sesi' && <SesiEditor acara={a} />}
      {tab === 'pintu' && <PintuTab acara={a} />}
      {tab === 'kehadiran' && <KehadiranTab acara={a} />}
      {tab === 'peserta' && <PesertaTab acaraId={id} kategori={kategori.data?.items ?? []} />}
      {tab === 'pj' && <PjTab acara={a} />}
      {tab === 'foto' && <FotoTab acara={a} />}
    </div>
  );
}

function PesertaTab({ acaraId, kategori }: { acaraId: string; kategori: Kategori[] }) {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const qs = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (search) qs.set('q', search);
  const list = useQuery({
    queryKey: ['acara', acaraId, 'peserta', qs.toString()],
    queryFn: () => acaraApi<Paginated<Peserta>>(`/acara/${acaraId}/peserta?${qs.toString()}`),
    placeholderData: keepPreviousData,
  });
  const byKode = new Map(kategori.map((k) => [k.kode, k]));
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / 25)) : 1;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cari-peserta">Cari peserta</Label>
          <Input
            id="cari-peserta"
            placeholder="Nama atau kode"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-64"
          />
        </div>
        {list.data && (
          <span className="pb-2 text-sm text-muted-foreground">{list.data.total} orang</span>
        )}
      </div>
      {list.error && <Alert variant="destructive">{errorMessage(list.error)}</Alert>}
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>L/P</TableHead>
              <TableHead>Kelompok</TableHead>
              <TableHead>Kategori</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data?.items.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.kode}</TableCell>
                <TableCell>
                  <Link href={`/admin/anggota/${p.id}`} className="hover:underline">
                    {p.nama}
                  </Link>
                </TableCell>
                <TableCell>{p.jenisKelamin}</TableCell>
                <TableCell>
                  {p.namaKelompok}{' '}
                  <span className="text-xs text-muted-foreground">{p.namaDesa}</span>
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1">
                    {p.kategori.map((k) => {
                      const ref = byKode.get(k);
                      return ref ? <KategoriChip key={k} kategori={ref} /> : null;
                    })}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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
    </div>
  );
}

function PjTab({ acara }: { acara: AcaraDetail }) {
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => api<UserRow[]>('/users'),
    enabled: acara.bisaKelola,
  });
  const [error, setError] = useState<string | null>(null);
  const save = async (path: string, method: string, body?: Record<string, unknown>) => {
    setError(null);
    try {
      qc.setQueryData(['acara', acara.id], await acaraApi<AcaraDetail>(path, { method, body }));
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await save(`/acara/${acara.id}/pj`, 'POST', {
      userId: String(f.get('userId')),
      peran: String(f.get('peran')),
      keterangan: String(f.get('keterangan') ?? '').trim() || null,
    });
    e.currentTarget?.reset();
  }
  const kandidat = (users.data ?? []).filter(
    (u) => u.aktif && (u.role === 'ADMIN' || u.role === 'PENGURUS' || u.role === 'SUPER_ADMIN'),
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-2">
        {error && <Alert variant="destructive">{error}</Alert>}
        {acara.pj.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada penanggung jawab.</p>
        ) : (
          <ul className="grid gap-2">
            {acara.pj.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex-1">
                  <div className="font-medium">{p.nama}</div>
                  <div className="text-sm text-muted-foreground">
                    {PERAN_PJ_LABEL[p.peran]}
                    {p.keterangan && ` · ${p.keterangan}`}
                  </div>
                </div>
                {acara.bisaKelola && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Hapus ${p.nama}`}
                    onClick={() => save(`/acara/${acara.id}/pj/${p.id}`, 'DELETE')}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {acara.bisaKelola && (
        <Card>
          <CardHeader>
            <CardTitle>Tambah PJ</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pj-user">Pengguna</Label>
                <NativeSelect id="pj-user" name="userId" required>
                  <option value="">Pilih pengguna</option>
                  {kandidat.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nama} ({ROLE_LABEL[u.role]})
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pj-peran">Peran</Label>
                <NativeSelect id="pj-peran" name="peran" defaultValue="PJ_UMUM">
                  {(Object.keys(PERAN_PJ_LABEL) as PeranPJ[]).map((p) => (
                    <option key={p} value={p}>
                      {PERAN_PJ_LABEL[p]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pj-ket">Keterangan</Label>
                <Input id="pj-ket" name="keterangan" maxLength={200} />
              </div>
              <Button type="submit">Tambahkan</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Kecilkan gambar di browser (maks 1600 px, WebP) sebelum diunggah. */
async function kompres(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const skala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * skala);
  canvas.height = Math.round(bmp.height * skala);
  canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/webp', 0.85));
}

function FotoTab({ acara }: { acara: AcaraDetail }) {
  const qc = useQueryClient();
  const key = ['acara', acara.id, 'foto'];
  const foto = useQuery({
    queryKey: key,
    queryFn: () => acaraApi<Foto[]>(`/acara/${acara.id}/foto`),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lihat, setLihat] = useState<Foto | null>(null);
  const sesiNama = new Map(acara.sesi.map((s) => [s.id, s.nama]));

  async function upload(files: FileList | null, sesiId: string, caption: string) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', await kompres(file), file.name.replace(/\.\w+$/, '.webp'));
        if (caption) form.append('caption', caption);
        if (sesiId) form.append('sesiId', sesiId);
        await acaraApi(`/acara/${acara.id}/foto`, { method: 'POST', body: form });
      }
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {acara.bisaKelola && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed p-4"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="foto-sesi">Sesi</Label>
            <NativeSelect id="foto-sesi" name="sesiId">
              <option value="">Tanpa sesi</option>
              {acara.sesi.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="foto-caption">Keterangan</Label>
            <Input id="foto-caption" name="caption" maxLength={300} />
          </div>
          <Button asChild disabled={busy}>
            <label className="cursor-pointer">
              <ImagePlus /> {busy ? 'Mengunggah…' : 'Pilih foto'}
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  const form = e.currentTarget.form;
                  const fd = form ? new FormData(form) : null;
                  void upload(
                    e.currentTarget.files,
                    String(fd?.get('sesiId') ?? ''),
                    String(fd?.get('caption') ?? '').trim(),
                  ).then(() => form?.reset());
                }}
              />
            </label>
          </Button>
        </form>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
      {foto.data?.length === 0 && <p className="text-sm text-muted-foreground">Belum ada foto.</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {foto.data?.map((f) => (
          <li key={f.id} className="group relative overflow-hidden rounded-lg border bg-muted">
            <button type="button" className="block w-full" onClick={() => setLihat(f)}>
              <AuthImage path={`/foto/${f.id}/file?thumb=1`} alt={f.caption ?? 'Foto kegiatan'} />
            </button>
            <div className="flex items-start gap-1 p-2 text-xs">
              <div className="flex-1">
                {f.caption && <div className="font-medium">{f.caption}</div>}
                <div className="text-muted-foreground">
                  {f.sesiId ? sesiNama.get(f.sesiId) : 'Tanpa sesi'}
                </div>
              </div>
              {acara.bisaKelola && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Hapus foto"
                  onClick={async () => {
                    if (!confirm('Hapus foto ini?')) return;
                    await acaraApi(`/foto/${f.id}`, { method: 'DELETE' });
                    await qc.invalidateQueries({ queryKey: key });
                  }}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {lihat && (
        <div
          role="dialog"
          aria-label={lihat.caption ?? 'Foto'}
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          onClick={() => setLihat(null)}
        >
          <AuthImage
            path={`/foto/${lihat.id}/file`}
            alt={lihat.caption ?? 'Foto kegiatan'}
            className="aspect-auto max-h-[90dvh] w-auto max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}
