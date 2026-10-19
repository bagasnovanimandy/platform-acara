'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Daerah } from './types';

export function useWilayahTree() {
  return useQuery({ queryKey: ['wilayah', 'tree'], queryFn: () => api<Daerah[]>('/wilayah/tree') });
}

/** `2010-03-05T00:00:00.000Z` → `05/03/2010` */
export function formatTanggal(iso: string | null): string {
  if (!iso) return '–';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
