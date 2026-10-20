'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';

/** Menu "Keuangan (SiKU)" tampil bila user punya peran SiKU dan core sudah diatur SIKU_URL. */
export function useSikuTersedia(): boolean {
  const user = useAuth((s) => s.user);
  const q = useQuery({
    queryKey: ['auth', 'me', user?.id],
    queryFn: () => api<{ sikuTersedia?: boolean }>('/auth/me'),
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return q.data?.sikuTersedia ?? false;
}

/** Minta token sekali pakai ke core lalu pindah ke SiKU. */
export async function bukaSiku(): Promise<void> {
  const { url } = await api<{ url: string }>('/auth/sso/siku', { method: 'POST' });
  window.location.assign(url);
}
