'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { use, useState } from 'react';
import { KategoriList } from '@/components/kategori-badge';
import { RiwayatList } from '@/components/riwayat-list';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, errorMessage } from '@/lib/api';
import { canEdit, useAuth } from '@/lib/auth';
import { formatTanggal, useWilayahTree, wilayahNames } from '@/lib/queries';
import type { AnggotaDetail, AuditLog } from '@/lib/types';
import { AnggotaFormDialog, MutasiDialog } from '../anggota-form';

const STATUS_VARIANT = { AKTIF: 'secondary', PINDAH: 'outline', NONAKTIF: 'destructive' } as const;

function umur(tgl: string | null): string | null {
  if (!tgl) return null;
  const lahir = new Date(tgl);
  const now = new Date();
  let u = now.getFullYear() - lahir.getUTCFullYear();
  if (
    now.getMonth() < lahir.getUTCMonth() ||
    (now.getMonth() === lahir.getUTCMonth() && now.getDate() < lahir.getUTCDate())
  )
    u--;
  return `${u} tahun`;
}

export default function AnggotaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useAuth((s) => s.user);
  const editable = canEdit(user);
  const tree = useWilayahTree();
  const names = wilayahNames(tree.data ?? []);
  const [editOpen, setEditOpen] = useState(false);
  const [moving, setMoving] = useState(false);

  const anggota = useQuery({
    queryKey: ['anggota', 'detail', id],
    queryFn: () => api<AnggotaDetail>(`/anggota/${id}`),
  });
  const riwayat = useQuery({
    queryKey: ['anggota', 'riwayat', id],
    queryFn: () => api<AuditLog[]>(`/anggota/${id}/riwayat`),
  });

  if (anggota.error) return <Alert variant="destructive">{errorMessage(anggota.error)}</Alert>;
  const a = anggota.data;
  if (!a) return <p className="text-muted-foreground">Memuat…</p>;

  const inisial = a.nama
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-muted-foreground">
        <Link href="/admin/anggota" className="hover:underline">
          Anggota
        </Link>{' '}
        / {a.kode}
      </nav>

      <section className="flex flex-wrap items-center gap-4">
        <div
          aria-hidden
          className="grid size-16 place-items-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground"
        >
          {inisial}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-2xl font-semibold">{a.nama}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">{a.kode}</span>
            <span aria-hidden>·</span>
            <span>
              {a.kelompok.nama} – {a.kelompok.desa.nama} – {a.kelompok.desa.daerah.nama}
            </span>
            <Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge>
          </div>
          <KategoriList kategori={a.kategori} />
        </div>
        {editable && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setMoving(true)}>
              Pindah kelompok
            </Button>
            <Button onClick={() => setEditOpen(true)}>Ubah data</Button>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Jenis kelamin</dt>
                <dd>{a.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</dd>
                <dt className="text-muted-foreground">Tanggal lahir</dt>
                <dd>
                  {formatTanggal(a.tanggalLahir)}
                  {umur(a.tanggalLahir) && (
                    <span className="text-muted-foreground"> ({umur(a.tanggalLahir)})</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">No WA</dt>
                <dd>{a.noWa ?? '–'}</dd>
                <dt className="text-muted-foreground">Terdaftar</dt>
                <dd>{formatTanggal(a.createdAt)}</dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Wali</CardTitle>
            </CardHeader>
            <CardContent>
              {a.wali.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada wali.</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {a.wali.map((w) => (
                    <li key={w.wali.id} className="flex flex-wrap justify-between gap-2">
                      <span>
                        {w.wali.nama}{' '}
                        <span className="text-muted-foreground">({w.hubungan.toLowerCase()})</span>
                      </span>
                      <span className="font-mono text-muted-foreground">{w.wali.noWa}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Riwayat pindah kelompok</CardTitle>
            </CardHeader>
            <CardContent>
              {a.mutasi.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum pernah pindah.</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {a.mutasi.map((m) => (
                    <li key={m.id}>
                      <span className="text-muted-foreground">{formatTanggal(m.tanggal)}</span>{' '}
                      {names.get(m.dariKelompokId) ?? 'kelompok lain'} →{' '}
                      {names.get(m.keKelompokId) ?? 'kelompok lain'}
                      {m.catatan && <span className="text-muted-foreground"> · {m.catatan}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat perubahan</CardTitle>
          </CardHeader>
          <CardContent>
            {riwayat.error ? (
              <Alert variant="destructive">{errorMessage(riwayat.error)}</Alert>
            ) : (
              <RiwayatList items={riwayat.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>

      <AnggotaFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        anggota={a}
        tree={tree.data ?? []}
      />
      <MutasiDialog
        anggota={moving ? a : null}
        onOpenChange={(o) => !o && setMoving(false)}
        tree={tree.data ?? []}
      />
    </div>
  );
}
