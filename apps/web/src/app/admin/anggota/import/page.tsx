'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { KategoriBadge } from '@/components/kategori-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, apiBlob, errorMessage } from '@/lib/api';
import { formatTanggal } from '@/lib/queries';
import type { ImportResult } from '@/lib/types';

const COLUMNS =
  'Nama, JK, Tgl Lahir, Kategori, No WA, No WA Ortu, Nama Ortu, Kelompok, Desa, Daerah';

export default function ImportPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const run = useMutation({
    mutationFn: ({ dryRun }: { dryRun: boolean }) => {
      const form = new FormData();
      form.append('file', file!);
      return api<ImportResult>(`/anggota/import?dryRun=${dryRun}`, { method: 'POST', body: form });
    },
    onSuccess: (r) => {
      if (!r.dryRun) void qc.invalidateQueries({ queryKey: ['anggota'] });
    },
  });
  const result = run.data;

  async function downloadTemplate() {
    const blob = await apiBlob('/anggota/import/template');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-import-anggota.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    run.reset();
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/anggota" className="text-sm text-muted-foreground hover:underline">
          ← Anggota
        </Link>
        <h1 className="text-2xl font-semibold">Import anggota dari Excel</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Siapkan file</CardTitle>
          <CardDescription>
            Baris pertama berisi judul kolom: {COLUMNS}. Nama wilayah harus sama dengan data wilayah
            (huruf besar/kecil tidak masalah). Tanggal lahir pakai format dd/mm/yyyy. Kategori boleh
            dikosongkan bila belum di-assessment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void downloadTemplate()}>
            Unduh template
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Periksa</CardTitle>
          <CardDescription>File diperiksa dulu tanpa disimpan.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="max-w-sm"
            onChange={(e) => {
              run.reset();
              setFile(e.target.files?.[0] ?? null);
            }}
          />
          <Button disabled={!file || run.isPending} onClick={() => run.mutate({ dryRun: true })}>
            {run.isPending && run.variables?.dryRun ? 'Memeriksa…' : 'Periksa file'}
          </Button>
        </CardContent>
      </Card>

      {run.error && <Alert variant="destructive">{errorMessage(run.error)}</Alert>}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{result.dryRun ? '3. Pratinjau' : 'Selesai'}</CardTitle>
            <CardDescription>
              {result.total} baris: {result.valid} siap diimpor, {result.gagal} bermasalah
              {result.gagal > 0 && result.dryRun ? ' (baris bermasalah akan dilewati)' : ''}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!result.dryRun && (
              <Alert variant="success">{result.dibuat} anggota berhasil ditambahkan.</Alert>
            )}
            {result.dryRun && result.valid > 0 && (
              <div className="flex gap-3">
                <Button
                  size="lg"
                  disabled={run.isPending}
                  onClick={() => run.mutate({ dryRun: false })}
                >
                  {run.isPending ? 'Mengimpor…' : `Impor ${result.valid} anggota`}
                </Button>
                <Button size="lg" variant="outline" onClick={reset}>
                  Batal
                </Button>
              </div>
            )}
            {!result.dryRun && (
              <div className="flex gap-3">
                <Button asChild>
                  <Link href="/admin/anggota">Lihat anggota</Link>
                </Button>
                <Button variant="outline" onClick={reset}>
                  Import file lain
                </Button>
              </div>
            )}

            {result.errors.length > 0 && (
              <div>
                <h3 className="mb-2 font-medium text-destructive">Baris bermasalah</h3>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Baris</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Masalah</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((e) => (
                        <TableRow key={e.baris}>
                          <TableCell>{e.baris}</TableCell>
                          <TableCell>{e.nama}</TableCell>
                          <TableCell className="whitespace-normal">{e.pesan.join('; ')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {result.dryRun && result.preview.length > 0 && (
              <div>
                <h3 className="mb-2 font-medium">
                  Contoh data siap impor
                  {result.valid > result.preview.length
                    ? ` (${result.preview.length} pertama)`
                    : ''}
                </h3>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Baris</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>JK</TableHead>
                        <TableHead>Tgl lahir</TableHead>
                        <TableHead>No WA</TableHead>
                        <TableHead>Wali</TableHead>
                        <TableHead>Kelompok – Desa – Daerah</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.preview.map((p) => (
                        <TableRow key={p.baris}>
                          <TableCell>{p.baris}</TableCell>
                          <TableCell className="font-medium">{p.nama}</TableCell>
                          <TableCell>
                            <KategoriBadge kategori={p.kategori} />
                          </TableCell>
                          <TableCell>{p.jenisKelamin}</TableCell>
                          <TableCell>{formatTanggal(p.tanggalLahir)}</TableCell>
                          <TableCell>{p.noWa ?? '–'}</TableCell>
                          <TableCell>
                            {p.noWaOrtu ? `${p.namaOrtu ?? ''} ${p.noWaOrtu}` : '–'}
                          </TableCell>
                          <TableCell>
                            {p.kelompok} – {p.desa} – {p.daerah}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
