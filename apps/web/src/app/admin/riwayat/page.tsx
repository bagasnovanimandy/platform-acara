'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { RiwayatList } from '@/components/riwayat-list';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { api, errorMessage } from '@/lib/api';
import type { AuditLog, Paginated } from '@/lib/types';

const PAGE_SIZE = 30;
const ENTITAS = ['Anggota', 'Kelompok', 'Desa', 'Daerah', 'Kategori', 'User'];

export default function RiwayatPage() {
  const [entitas, setEntitas] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (entitas) params.set('entitas', entitas);
  if (q) params.set('q', q);

  const list = useQuery({
    queryKey: ['audit', params.toString()],
    queryFn: () => api<Paginated<AuditLog>>(`/audit?${params.toString()}`),
    placeholderData: keepPreviousData,
  });
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Riwayat perubahan</h1>
        <p className="text-sm text-muted-foreground">
          Siapa mengubah apa dan kapan, di wilayah Anda.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="q">Cari</Label>
          <Input
            id="q"
            placeholder="Nama, kode, atau isi perubahan"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="entitas">Jenis data</Label>
          <NativeSelect
            id="entitas"
            value={entitas}
            onChange={(e) => {
              setEntitas(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua</option>
            {ENTITAS.map((x) => (
              <option key={x} value={x}>
                {x === 'User' ? 'Pengguna' : x}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {list.error && <Alert variant="destructive">{errorMessage(list.error)}</Alert>}
      <div className="rounded-xl border bg-card p-5">
        <RiwayatList items={list.data?.items ?? []} showEntitas />
      </div>
      {list.data && list.data.items.some((r) => r.entitas === 'Anggota') && (
        <p className="text-xs text-muted-foreground">
          Detail per anggota ada di halaman{' '}
          <Link href="/admin/anggota" className="underline">
            Anggota
          </Link>
          .
        </p>
      )}
      <div className="flex items-center justify-end gap-3 text-sm">
        <span className="text-muted-foreground">
          {list.data?.total ?? 0} catatan · halaman {page} dari {totalPages}
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
    </div>
  );
}
