'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { KategoriPicker } from '@/components/kategori-picker';
import { EMPTY_WILAYAH, WilayahSelect, type WilayahValue } from '@/components/wilayah-select';
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
import { NativeSelect } from '@/components/ui/native-select';
import { api, errorMessage } from '@/lib/api';
import type { Anggota, Daerah } from '@/lib/types';

/** Dialog tambah (anggota = null) atau ubah anggota. Kelompok hanya dipilih saat tambah; pindah lewat mutasi. */
export function AnggotaFormDialog({
  open,
  onOpenChange,
  anggota,
  tree,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anggota: Anggota | null;
  tree: Daerah[];
}) {
  const qc = useQueryClient();
  const [wilayah, setWilayah] = useState<WilayahValue>(EMPTY_WILAYAH);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      anggota
        ? api(`/anggota/${anggota.id}`, { method: 'PATCH', body })
        : api('/anggota', { method: 'POST', body }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['anggota'] });
      onOpenChange(false);
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      nama: f.get('nama'),
      jenisKelamin: f.get('jenisKelamin'),
      tanggalLahir: f.get('tanggalLahir') || null,
      kategori: f.get('kategori') || null,
      noWa: f.get('noWa') || null,
      status: f.get('status'),
    };
    if (!anggota) body.kelompokId = wilayah.kelompokId;
    save.mutate(body);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          save.reset();
          setWilayah(EMPTY_WILAYAH);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{anggota ? `Ubah ${anggota.kode}` : 'Tambah anggota'}</DialogTitle>
        </DialogHeader>
        <form key={anggota?.id ?? 'baru'} onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" required defaultValue={anggota?.nama} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="jenisKelamin">Jenis kelamin</Label>
              <NativeSelect
                id="jenisKelamin"
                name="jenisKelamin"
                defaultValue={anggota?.jenisKelamin ?? 'L'}
              >
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tanggalLahir">Tanggal lahir</Label>
              <Input
                id="tanggalLahir"
                name="tanggalLahir"
                type="date"
                defaultValue={anggota?.tanggalLahir?.slice(0, 10) ?? ''}
              />
            </div>
          </div>
          <KategoriPicker name="kategori" defaultValue={anggota?.kategori ?? null} />
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="noWa">No WA</Label>
              <Input
                id="noWa"
                name="noWa"
                inputMode="tel"
                placeholder="08…"
                defaultValue={anggota?.noWa ?? ''}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <NativeSelect id="status" name="status" defaultValue={anggota?.status ?? 'AKTIF'}>
                <option value="AKTIF">Aktif</option>
                <option value="PINDAH">Pindah</option>
                <option value="NONAKTIF">Nonaktif</option>
              </NativeSelect>
            </div>
          </div>
          {anggota ? (
            <p className="text-sm text-muted-foreground">
              Kelompok: {anggota.kelompok.nama} – {anggota.kelompok.desa.nama} –{' '}
              {anggota.kelompok.desa.daerah.nama}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <WilayahSelect
                tree={tree}
                value={wilayah}
                onChange={setWilayah}
                emptyLabel="Pilih"
                required
              />
            </div>
          )}
          {save.error && <Alert variant="destructive">{errorMessage(save.error)}</Alert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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

/** Pindah kelompok (mutasi sambung). Tujuan dipilih dari wilayah yang terlihat. */
export function MutasiDialog({
  anggota,
  onOpenChange,
  tree,
}: {
  anggota: Anggota | null;
  onOpenChange: (open: boolean) => void;
  tree: Daerah[];
}) {
  const qc = useQueryClient();
  const [wilayah, setWilayah] = useState<WilayahValue>(EMPTY_WILAYAH);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/anggota/${anggota?.id}/mutasi`, { method: 'POST', body }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['anggota'] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={anggota !== null}
      onOpenChange={(o) => {
        if (!o) {
          save.reset();
          setWilayah(EMPTY_WILAYAH);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pindah kelompok: {anggota?.nama}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              keKelompokId: wilayah.kelompokId,
              tanggal: f.get('tanggal'),
              catatan: f.get('catatan') || undefined,
            });
          }}
        >
          <p className="text-sm text-muted-foreground">Sekarang: {anggota?.kelompok.nama}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <WilayahSelect
              tree={tree}
              value={wilayah}
              onChange={setWilayah}
              emptyLabel="Pilih"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tanggal">Tanggal pindah</Label>
              <Input
                id="tanggal"
                name="tanggal"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="catatan">Catatan</Label>
              <Input id="catatan" name="catatan" />
            </div>
          </div>
          {save.error && <Alert variant="destructive">{errorMessage(save.error)}</Alert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Pindahkan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
