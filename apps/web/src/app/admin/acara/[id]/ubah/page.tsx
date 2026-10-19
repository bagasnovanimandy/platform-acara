'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { AcaraForm } from '@/components/acara-form';
import { Alert } from '@/components/ui/alert';
import { useAcara } from '@/lib/acara';
import { acaraApi, errorMessage } from '@/lib/api';

export default function UbahAcaraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const acara = useAcara(id);
  if (acara.error) return <Alert variant="destructive">{errorMessage(acara.error)}</Alert>;
  if (!acara.data) return <p className="text-muted-foreground">Memuat…</p>;
  if (!acara.data.bisaKelola)
    return <Alert variant="destructive">Acara ini diselenggarakan di luar wilayah Anda.</Alert>;
  return (
    <div className="flex flex-col gap-5">
      <nav className="text-sm text-muted-foreground">
        <Link href="/admin/acara" className="hover:underline">
          Acara
        </Link>{' '}
        /{' '}
        <Link href={`/admin/acara/${id}`} className="hover:underline">
          {acara.data.nama}
        </Link>{' '}
        / Ubah
      </nav>
      <h1 className="text-2xl font-semibold">Ubah acara</h1>
      <AcaraForm
        initial={acara.data}
        submitLabel="Simpan perubahan"
        onSubmit={async (input) => {
          await acaraApi(`/acara/${id}`, { method: 'PATCH', body: { ...input } });
          await qc.invalidateQueries({ queryKey: ['acara'] });
          router.push(`/admin/acara/${id}`);
        }}
      />
    </div>
  );
}
