'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Daerah, Kategori } from './types';

export function useWilayahTree() {
  return useQuery({ queryKey: ['wilayah', 'tree'], queryFn: () => api<Daerah[]>('/wilayah/tree') });
}

/** `2010-03-05T00:00:00.000Z` → `05/03/2010` */
export function formatTanggal(iso: string | null): string {
  if (!iso) return '–';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function useKategori() {
  return useQuery({
    queryKey: ['kategori'],
    queryFn: () => api<{ bisaKelola: boolean; items: Kategori[] }>('/kategori'),
    staleTime: 60_000,
  });
}

/** `2026-10-19T04:00:00Z` → `19 Okt 2026 11.00` (Asia/Jakarta). */
export function formatWaktu(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso));
}

/** Nama wilayah dari id (pohon wilayah yang terlihat user). */
export function wilayahNames(tree: Daerah[]) {
  const map = new Map<string, string>();
  for (const d of tree) {
    map.set(d.id, d.nama);
    for (const s of d.desa) {
      map.set(s.id, s.nama);
      for (const k of s.kelompok) map.set(k.id, k.nama);
    }
  }
  return map;
}
