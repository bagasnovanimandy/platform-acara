'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { KategoriList } from '@/components/kategori-badge';
import { EMPTY_WILAYAH, WilayahSelect, type WilayahValue } from '@/components/wilayah-select';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { api, errorMessage } from '@/lib/api';
import { canEdit, useAuth } from '@/lib/auth';
import { formatTanggal, useKategori, useWilayahTree } from '@/lib/queries';
import type { Anggota, Paginated } from '@/lib/types';
import { AnggotaFormDialog, MutasiDialog } from './anggota-form';

const PAGE_SIZE = 25;
const STATUS_VARIANT = { AKTIF: 'secondary', PINDAH: 'outline', NONAKTIF: 'destructive' } as const;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function AnggotaPageRoute() {
  return (
    <Suspense>
      <AnggotaPage />
    </Suspense>
  );
}

function AnggotaPage() {
  const user = useAuth((s) => s.user);
  const editable = canEdit(user);
  const tree = useWilayahTree();
  const kategoriList = useKategori();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [wilayah, setWilayah] = useState<WilayahValue>(EMPTY_WILAYAH);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [kategori, setKategori] = useState(searchParams.get('kategoriId') ?? '');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Anggota | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [moving, setMoving] = useState<Anggota | null>(null);
  const search = useDebounced(q, 300);

  // Filter wilayah dari tautan dashboard (?desaId= / ?kelompokId=), dilengkapi induknya dari pohon.
  const urlDesa = searchParams.get('desaId');
  const urlKelompok = searchParams.get('kelompokId');
  useEffect(() => {
    if (!tree.data || (!urlDesa && !urlKelompok)) return;
    for (const d of tree.data)
      for (const s of d.desa) {
        if (s.id === urlDesa) setWilayah({ daerahId: d.id, desaId: s.id, kelompokId: '' });
        const k = s.kelompok.find((k) => k.id === urlKelompok);
        if (k) setWilayah({ daerahId: d.id, desaId: s.id, kelompokId: k.id });
      }
  }, [tree.data, urlDesa, urlKelompok]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (search) params.set('q', search);
  if (status) params.set('status', status);
  if (kategori) params.set('kategoriId', kategori);
  if (wilayah.kelompokId) params.set('kelompokId', wilayah.kelompokId);
  else if (wilayah.desaId) params.set('desaId', wilayah.desaId);
  else if (wilayah.daerahId) params.set('daerahId', wilayah.daerahId);

  const list = useQuery({
    queryKey: ['anggota', params.toString()],
    queryFn: () => api<Paginated<Anggota>>(`/anggota?${params.toString()}`),
    placeholderData: keepPreviousData,
  });
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Anggota</h1>
        {list.data && <span className="text-muted-foreground">{list.data.total} orang</span>}
        {editable && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/anggota/import">Import Excel</Link>
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Tambah anggota
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="q">Cari</Label>
          <Input
            id="q"
            placeholder="Nama atau kode"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <WilayahSelect
          tree={tree.data ?? []}
          value={wilayah}
          onChange={(v) => {
            setWilayah(v);
            setPage(1);
          }}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="kategori-filter">Kategori</Label>
          <NativeSelect
            id="kategori-filter"
            value={kategori}
            onChange={(e) => {
              setKategori(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua</option>
            {kategoriList.data?.items.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
            <option value="BELUM">Belum diisi</option>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status-filter">Status</Label>
          <NativeSelect
            id="status-filter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua</option>
            <option value="AKTIF">Aktif</option>
            <option value="PINDAH">Pindah</option>
            <option value="NONAKTIF">Nonaktif</option>
          </NativeSelect>
        </div>
      </div>

      {list.error && <Alert variant="destructive">{errorMessage(list.error)}</Alert>}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>JK</TableHead>
              <TableHead>Tgl lahir</TableHead>
              <TableHead>No WA</TableHead>
              <TableHead>Kelompok – Desa</TableHead>
              <TableHead>Status</TableHead>
              {editable && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data?.items.map((a) => (
              <TableRow
                key={a.id}
                className="cursor-pointer"
                onClick={() => router.push(`/admin/anggota/${a.id}`)}
              >
                <TableCell className="font-mono text-xs">{a.kode}</TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={`/admin/anggota/${a.id}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {a.nama}
                  </Link>
                </TableCell>
                <TableCell>
                  <KategoriList kategori={a.kategori} />
                </TableCell>
                <TableCell>{a.jenisKelamin}</TableCell>
                <TableCell>{formatTanggal(a.tanggalLahir)}</TableCell>
                <TableCell>{a.noWa ?? '–'}</TableCell>
                <TableCell>
                  {a.kelompok.nama} – {a.kelompok.desa.nama}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge>
                </TableCell>
                {editable && (
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(a);
                        setFormOpen(true);
                      }}
                    >
                      Ubah
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setMoving(a)}>
                      Pindah
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {list.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Tidak ada anggota
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-3 text-sm">
        <span className="text-muted-foreground">
          Halaman {page} dari {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Sebelumnya
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Berikutnya
        </Button>
      </div>

      <AnggotaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        anggota={editing}
        tree={tree.data ?? []}
      />
      <MutasiDialog
        anggota={moving}
        onOpenChange={(o) => !o && setMoving(null)}
        tree={tree.data ?? []}
      />
    </div>
  );
}
