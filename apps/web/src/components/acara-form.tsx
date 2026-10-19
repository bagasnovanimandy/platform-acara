'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Building2, Home, Layers, Map as MapIcon, Users } from 'lucide-react';
import { type FormEvent, useDeferredValue, useMemo, useState } from 'react';
import { KATEGORI_TONE } from '@/components/kategori-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  type Acara,
  fromWibInput,
  type PreviewPeserta,
  STATUS_LABEL,
  type StatusAcara,
  type Tingkat,
  toWibInput,
  type WilayahPick,
} from '@/lib/acara';
import { acaraApi, errorMessage } from '@/lib/api';
import { useKategori, useWilayahTree } from '@/lib/queries';
import type { Daerah, Kategori } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface AcaraInput {
  nama: string;
  jenis: string;
  lokasi: string | null;
  deskripsi: string | null;
  tanggalMulai: string;
  tanggalSelesai: string;
  status: StatusAcara;
  tingkat: Tingkat;
  wilayah: WilayahPick[];
  jenisKelamin: 'L' | 'P' | null;
  kategori: string[];
}

const TINGKAT: { value: Tingkat; label: string; hint: string; icon: typeof Home }[] = [
  { value: 'KELOMPOK', label: 'Kelompok', hint: 'Satu kelompok', icon: Home },
  { value: 'DESA', label: 'Desa', hint: 'Semua kelompok di satu desa', icon: Building2 },
  { value: 'DAERAH', label: 'Daerah', hint: 'Seluruh daerah', icon: MapIcon },
  { value: 'GABUNGAN', label: 'Gabungan', hint: 'Pilih beberapa desa/kelompok', icon: Layers },
];

const JENIS_SARAN = ['Pengajian umum', 'Pengajian kelompok', 'Pengajian desa', 'Pengajian daerah'];

export function AcaraForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Acara;
  submitLabel: string;
  onSubmit: (input: AcaraInput) => Promise<void>;
}) {
  const tree = useWilayahTree();
  const kategori = useKategori();
  const [tingkat, setTingkat] = useState<Tingkat>(initial?.tingkat ?? 'KELOMPOK');
  const [wilayah, setWilayah] = useState<WilayahPick[]>(
    initial?.wilayah.map((w) => ({ level: w.level, id: w.id })) ?? [],
  );
  const [jk, setJk] = useState<'L' | 'P' | null>(initial?.jenisKelamin ?? null);
  const [kat, setKat] = useState<string[]>(initial?.kategori ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const peserta = useDeferredValue({ tingkat, wilayah, jenisKelamin: jk, kategori: kat });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? '').trim();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        nama: s('nama'),
        jenis: s('jenis'),
        lokasi: s('lokasi') || null,
        deskripsi: s('deskripsi') || null,
        tanggalMulai: fromWibInput(s('tanggalMulai')),
        tanggalSelesai: fromWibInput(s('tanggalSelesai')),
        status: s('status') as StatusAcara,
        tingkat,
        wilayah,
        jenisKelamin: jk,
        kategori: kat,
      });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informasi acara</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="nama">Nama acara</Label>
              <Input id="nama" name="nama" required maxLength={150} defaultValue={initial?.nama} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="jenis">Jenis</Label>
              <Input
                id="jenis"
                name="jenis"
                required
                list="jenis-saran"
                maxLength={60}
                defaultValue={initial?.jenis}
              />
              <datalist id="jenis-saran">
                {JENIS_SARAN.map((j) => (
                  <option key={j} value={j} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Status</Label>
              <NativeSelect id="status" name="status" defaultValue={initial?.status ?? 'DRAFT'}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tanggalMulai">Mulai (WIB)</Label>
              <Input
                id="tanggalMulai"
                name="tanggalMulai"
                type="datetime-local"
                required
                defaultValue={toWibInput(initial?.tanggalMulai)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tanggalSelesai">Selesai (WIB)</Label>
              <Input
                id="tanggalSelesai"
                name="tanggalSelesai"
                type="datetime-local"
                required
                defaultValue={toWibInput(initial?.tanggalSelesai)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="lokasi">Lokasi</Label>
              <Input
                id="lokasi"
                name="lokasi"
                maxLength={200}
                defaultValue={initial?.lokasi ?? ''}
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="deskripsi">Keterangan</Label>
              <textarea
                id="deskripsi"
                name="deskripsi"
                rows={3}
                maxLength={2000}
                defaultValue={initial?.deskripsi ?? ''}
                className="rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Siapa yang ikut</CardTitle>
            <CardDescription>
              Pilih tingkat dan wilayah, lalu batasi dengan kategori atau jenis kelamin bila perlu.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Tingkat acara</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TINGKAT.map((t) => {
                  const Icon = t.icon;
                  const on = tingkat === t.value;
                  return (
                    <label
                      key={t.value}
                      className={cn(
                        'flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-left transition-colors',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                        on ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted',
                      )}
                    >
                      <input
                        type="radio"
                        name="tingkat"
                        value={t.value}
                        checked={on}
                        onChange={() => {
                          setTingkat(t.value);
                          setWilayah([]);
                        }}
                        className="sr-only"
                      />
                      <Icon className="size-4" aria-hidden />
                      <span className="text-sm font-medium">{t.label}</span>
                      <span className="text-xs text-muted-foreground">{t.hint}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {tree.data && (
              <WilayahPicker
                tree={tree.data}
                tingkat={tingkat}
                value={wilayah}
                onChange={setWilayah}
              />
            )}

            <KategoriFilter options={kategori.data?.items ?? []} value={kat} onChange={setKat} />

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Jenis kelamin</legend>
              <div className="inline-flex rounded-lg border p-1">
                {(
                  [
                    [null, 'Semua'],
                    ['L', 'Laki-laki'],
                    ['P', 'Perempuan'],
                  ] as const
                ).map(([v, l]) => (
                  <label
                    key={l}
                    className={cn(
                      'cursor-pointer rounded-md px-3 py-1.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                      jk === v ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                    )}
                  >
                    <input
                      type="radio"
                      name="jk"
                      checked={jk === v}
                      onChange={() => setJk(v)}
                      className="sr-only"
                    />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        {error && <Alert variant="destructive">{error}</Alert>}
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? 'Menyimpan…' : submitLabel}
          </Button>
        </div>
      </div>

      <PreviewPanel
        peserta={peserta}
        kategori={kategori.data?.items ?? []}
        tree={tree.data ?? []}
      />
    </form>
  );
}

function WilayahPicker({
  tree,
  tingkat,
  value,
  onChange,
}: {
  tree: Daerah[];
  tingkat: Tingkat;
  value: WilayahPick[];
  onChange: (v: WilayahPick[]) => void;
}) {
  const single = value[0]?.id ?? '';
  const pickOne = (level: WilayahPick['level']) => (id: string) =>
    onChange(id ? [{ level, id }] : []);

  if (tingkat === 'DAERAH') {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor="w-daerah">Daerah</Label>
        <NativeSelect
          id="w-daerah"
          value={single}
          onChange={(e) => pickOne('DAERAH')(e.target.value)}
        >
          <option value="">Pilih daerah</option>
          {tree.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nama}
            </option>
          ))}
        </NativeSelect>
      </div>
    );
  }
  if (tingkat === 'DESA') {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor="w-desa">Desa</Label>
        <NativeSelect id="w-desa" value={single} onChange={(e) => pickOne('DESA')(e.target.value)}>
          <option value="">Pilih desa</option>
          {tree.map((d) => (
            <optgroup key={d.id} label={d.nama}>
              {d.desa.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama}
                </option>
              ))}
            </optgroup>
          ))}
        </NativeSelect>
      </div>
    );
  }
  if (tingkat === 'KELOMPOK') {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor="w-kelompok">Kelompok</Label>
        <NativeSelect
          id="w-kelompok"
          value={single}
          onChange={(e) => pickOne('KELOMPOK')(e.target.value)}
        >
          <option value="">Pilih kelompok</option>
          {tree.flatMap((d) =>
            d.desa.map((s) => (
              <optgroup key={s.id} label={s.nama}>
                {s.kelompok.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
              </optgroup>
            )),
          )}
        </NativeSelect>
      </div>
    );
  }

  // GABUNGAN: centang desa (seluruh kelompoknya) atau kelompok satu per satu.
  const has = (id: string) => value.some((w) => w.id === id);
  const toggleDesa = (desaId: string, kelompokIds: string[]) =>
    onChange(
      has(desaId)
        ? value.filter((w) => w.id !== desaId)
        : [...value.filter((w) => !kelompokIds.includes(w.id)), { level: 'DESA', id: desaId }],
    );
  const toggleKelompok = (id: string) =>
    onChange(has(id) ? value.filter((w) => w.id !== id) : [...value, { level: 'KELOMPOK', id }]);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">
        Wilayah yang ikut{' '}
        <span className="font-normal text-muted-foreground">({value.length} dipilih)</span>
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {tree.flatMap((d) =>
          d.desa.map((s) => {
            const desaOn = has(s.id);
            return (
              <div key={s.id} className="rounded-lg border p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={desaOn}
                    onChange={() =>
                      toggleDesa(
                        s.id,
                        s.kelompok.map((k) => k.id),
                      )
                    }
                    className="size-4 accent-primary"
                  />
                  {s.nama}
                  <span className="text-xs font-normal text-muted-foreground">seluruh desa</span>
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
                  {s.kelompok.map((k) => {
                    const on = desaOn || has(k.id);
                    return (
                      <label
                        key={k.id}
                        className={cn(
                          'inline-flex cursor-pointer items-center rounded-full border px-2.5 py-1 text-xs select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                          on ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted',
                          desaOn && 'cursor-not-allowed opacity-70',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={desaOn}
                          onChange={() => toggleKelompok(k.id)}
                          className="sr-only"
                        />
                        {k.nama}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          }),
        )}
      </div>
    </fieldset>
  );
}

function KategoriFilter({
  options,
  value,
  onChange,
}: {
  options: Kategori[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const shown = options.filter((o) => o.aktif || value.includes(o.kode));
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">
        Kategori peserta{' '}
        <span className="font-normal text-muted-foreground">
          {value.length ? `(${value.length} dipilih)` : '(kosong = semua kategori)'}
        </span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {shown.map((o) => {
          const on = value.includes(o.kode);
          return (
            <label
              key={o.id}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors select-none',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
                on
                  ? cn(
                      'border-transparent font-medium ring-1 ring-inset',
                      KATEGORI_TONE[o.warna].chip,
                    )
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() =>
                  onChange(on ? value.filter((x) => x !== o.kode) : [...value, o.kode])
                }
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'size-2 rounded-full',
                  on ? KATEGORI_TONE[o.warna].dot : 'bg-muted-foreground/40',
                )}
              />
              {o.nama}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function PreviewPanel({
  peserta,
  kategori,
  tree,
}: {
  peserta: Pick<AcaraInput, 'tingkat' | 'wilayah' | 'jenisKelamin' | 'kategori'>;
  kategori: Kategori[];
  tree: Daerah[];
}) {
  const ready = peserta.wilayah.length >= (peserta.tingkat === 'GABUNGAN' ? 2 : 1);
  const preview = useQuery({
    queryKey: ['acara', 'preview', peserta],
    queryFn: () =>
      acaraApi<PreviewPeserta>('/acara/peserta/preview', { method: 'POST', body: { ...peserta } }),
    enabled: ready,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const byKode = useMemo(() => new Map(kategori.map((k) => [k.kode, k])), [kategori]);
  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of tree) {
      m.set(d.id, d.nama);
      for (const s of d.desa) {
        m.set(s.id, s.nama);
        for (const k of s.kelompok) m.set(k.id, k.nama);
      }
    }
    return m;
  }, [tree]);
  const p = preview.data;
  const max = Math.max(1, ...(p?.perKelompok.map((k) => k.jumlah) ?? []));

  return (
    <Card className="lg:sticky lg:top-20" aria-live="polite">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" aria-hidden /> Perkiraan peserta
        </CardTitle>
        <CardDescription>Anggota aktif yang cocok dengan pilihan di samping.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!ready ? (
          <p className="text-sm text-muted-foreground">
            {peserta.tingkat === 'GABUNGAN'
              ? 'Pilih minimal dua desa atau kelompok.'
              : 'Pilih wilayah dulu.'}
          </p>
        ) : preview.error ? (
          <Alert variant="destructive">{errorMessage(preview.error)}</Alert>
        ) : !p ? (
          <p className="text-sm text-muted-foreground">Menghitung…</p>
        ) : (
          <>
            <div className={cn('transition-opacity', preview.isFetching && 'opacity-60')}>
              <div className="text-4xl font-semibold tabular-nums">
                {p.total.toLocaleString('id-ID')}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {p.perJenisKelamin.L ?? 0} laki-laki · {p.perJenisKelamin.P ?? 0} perempuan
              </div>
              {p.penyelenggara && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Penyelenggara: {names.get(p.penyelenggara.id) ?? p.penyelenggara.level}
                </div>
              )}
            </div>
            {peserta.kategori.length > 0 && (
              <ul className="grid gap-1.5 text-sm">
                {peserta.kategori.map((kode) => {
                  const k = byKode.get(kode);
                  return (
                    <li key={kode} className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          'size-2 rounded-full',
                          k ? KATEGORI_TONE[k.warna].dot : 'bg-muted',
                        )}
                      />
                      <span className="flex-1">{k?.nama ?? kode}</span>
                      <span className="tabular-nums">{p.perKategori[kode] ?? 0}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {p.perKelompok.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Per kelompok
                </div>
                <ul className="grid max-h-64 gap-2 overflow-y-auto pr-1">
                  {p.perKelompok.map((k) => (
                    <li key={k.kelompokId} className="grid gap-1 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="truncate">
                          {k.namaKelompok}{' '}
                          <span className="text-xs text-muted-foreground">{k.namaDesa}</span>
                        </span>
                        <span className="tabular-nums">{k.jumlah}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-500"
                          style={{ width: `${(k.jumlah / max) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {p.contoh.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Contoh: {p.contoh.map((c) => c.nama).join(', ')}
                {p.total > p.contoh.length && ', …'}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
