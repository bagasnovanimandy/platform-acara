'use client';

import { KATEGORI_WARNA, type KategoriWarna } from '@platform-acara/shared/kategori';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { KATEGORI_TONE } from '@/components/kategori-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, errorMessage } from '@/lib/api';
import { useKategori } from '@/lib/queries';
import type { Kategori } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function KategoriPage() {
  const kategori = useKategori();
  const [editing, setEditing] = useState<Kategori | 'baru' | null>(null);
  const items = kategori.data?.items ?? [];
  const total = Math.max(1, ...items.map((k) => k.jumlahAnggota));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Kategori</h1>
          <p className="text-sm text-muted-foreground">
            Dipakai untuk memilih peserta acara. Satu anggota boleh punya banyak kategori.
          </p>
        </div>
        {kategori.data?.bisaKelola && (
          <Button className="ml-auto" onClick={() => setEditing('baru')}>
            Tambah kategori
          </Button>
        )}
      </div>

      {kategori.error && <Alert variant="destructive">{errorMessage(kategori.error)}</Alert>}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((k) => (
          <li
            key={k.id}
            className={cn(
              'group relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm',
              !k.aktif && 'opacity-60',
            )}
          >
            <div className="flex items-center gap-2">
              <span aria-hidden className={cn('size-3 rounded-full', KATEGORI_TONE[k.warna].dot)} />
              <span className="font-medium">{k.nama}</span>
              {!k.aktif && (
                <span className="rounded-full border px-2 text-xs text-muted-foreground">
                  Nonaktif
                </span>
              )}
              {kategori.data?.bisaKelola && (
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setEditing(k)}>
                  Ubah
                </Button>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <Link
                href={`/admin/anggota?kategoriId=${k.id}`}
                className="text-3xl font-semibold tabular-nums hover:underline"
              >
                {k.jumlahAnggota}
              </Link>
              <span className="text-sm text-muted-foreground">anggota</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full', KATEGORI_TONE[k.warna].dot)}
                style={{ width: `${(k.jumlahAnggota / total) * 100}%` }}
              />
            </div>
            <span className="font-mono text-xs text-muted-foreground">{k.kode}</span>
          </li>
        ))}
      </ul>

      <KategoriDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function KategoriDialog({
  value,
  onClose,
}: {
  value: Kategori | 'baru' | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const current = value === 'baru' ? null : value;
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      current
        ? api(`/kategori/${current.id}`, { method: 'PATCH', body })
        : api('/kategori', { method: 'POST', body }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['kategori'] });
      onClose();
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { nama: f.get('nama'), warna: f.get('warna') };
    if (current) body.aktif = f.get('aktif') === 'on';
    save.mutate(body);
  }

  return (
    <Dialog
      open={value !== null}
      onOpenChange={(o) => {
        if (o) return;
        save.reset();
        onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{current ? `Ubah ${current.nama}` : 'Tambah kategori'}</DialogTitle>
        </DialogHeader>
        <form key={current?.id ?? 'baru'} onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" required maxLength={50} defaultValue={current?.nama} />
            {current && (
              <p className="text-xs text-muted-foreground">
                Kode <span className="font-mono">{current.kode}</span> tetap walau nama diubah.
              </p>
            )}
          </div>
          <WarnaPicker defaultValue={current?.warna ?? 'slate'} />
          {current && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="aktif"
                defaultChecked={current.aktif}
                className="size-4"
              />
              Aktif (bisa dipilih untuk anggota dan acara)
            </label>
          )}
          {save.error && <Alert variant="destructive">{errorMessage(save.error)}</Alert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WarnaPicker({ defaultValue }: { defaultValue: KategoriWarna }) {
  const [warna, setWarna] = useState<KategoriWarna>(defaultValue);
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">Warna</legend>
      <div className="flex flex-wrap gap-2">
        {KATEGORI_WARNA.map((w) => (
          <label
            key={w}
            title={w}
            className="grid size-8 cursor-pointer place-items-center rounded-full ring-offset-2 has-[:checked]:ring-2 has-[:checked]:ring-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
          >
            <input
              type="radio"
              name="warna"
              value={w}
              checked={warna === w}
              onChange={() => setWarna(w)}
              className="sr-only"
              aria-label={w}
            />
            <span className={cn('size-6 rounded-full', KATEGORI_TONE[w].dot)} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
