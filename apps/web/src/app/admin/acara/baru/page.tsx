'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AcaraForm } from '@/components/acara-form';
import type { AcaraDetail } from '@/lib/acara';
import { acaraApi } from '@/lib/api';

export default function AcaraBaruPage() {
  const router = useRouter();
  const qc = useQueryClient();
  return (
    <div className="flex flex-col gap-5">
      <nav className="text-sm text-muted-foreground">
        <Link href="/admin/acara" className="hover:underline">
          Acara
        </Link>{' '}
        / Baru
      </nav>
      <h1 className="text-2xl font-semibold">Buat acara</h1>
      <AcaraForm
        submitLabel="Simpan acara"
        onSubmit={async (input) => {
          const a = await acaraApi<AcaraDetail>('/acara', { method: 'POST', body: { ...input } });
          await qc.invalidateQueries({ queryKey: ['acara'] });
          router.push(`/admin/acara/${a.id}`);
        }}
      />
    </div>
  );
}
