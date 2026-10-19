'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { AnggotaRingkas } from '@/lib/acara';
import { acaraApi } from '@/lib/api';

/** Kotak cari anggota (salinan AnggotaRef di acara-svc). */
export function CariAnggota({
  onPick,
  label = 'Cari anggota sebagai pengisi',
  className,
}: {
  onPick: (a: AnggotaRingkas) => void;
  label?: string;
  className?: string;
}) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const hasil = useQuery({
    queryKey: ['anggota-ref', 'cari', debounced],
    queryFn: () =>
      acaraApi<AnggotaRingkas[]>(`/anggota-ref/cari?q=${encodeURIComponent(debounced)}&limit=8`),
    enabled: debounced.length >= 2,
  });
  return (
    <div className="relative flex-1">
      <Input
        aria-label={label}
        placeholder={`${label}…`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className={className ?? 'h-8'}
      />
      {debounced.length >= 2 && hasil.data && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-background p-1 shadow-md">
          {hasil.data.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ditemukan</li>
          )}
          {hasil.data.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onPick(a);
                  setQ('');
                }}
              >
                {a.nama}
                <span className="text-xs text-muted-foreground">
                  {a.kode} · {a.namaKelompok}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
