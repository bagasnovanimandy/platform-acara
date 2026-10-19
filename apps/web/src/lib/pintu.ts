'use client';

import { useSse } from './sse';

export type StatusPintu = 'BELUM_LOGIN' | 'ONLINE' | 'IDLE' | 'OFFLINE' | 'DICABUT';

export interface Pintu {
  id: string;
  nomor: number;
  label: string;
  kode: string;
  status: StatusPintu;
  lastSeenAt: string | null;
  lastScanAt: string | null;
  antrean: number;
  sedangInput: boolean;
  baterai: number | null;
  perangkat: string | null;
  qrDipakai: boolean;
  revokedAt: string | null;
  jumlahInput: number;
}

export interface MonitorSnapshot {
  now: string;
  hadir: number;
  tamu: number;
  pintu: Pintu[];
}

/** Kartu pintu baru (PIN hanya ada di respons generate / reset). */
export interface KartuPintu {
  id: string;
  nomor: number;
  label: string;
  kode: string;
  pin: string;
  url: string;
}

export const STATUS_PINTU: Record<StatusPintu, { label: string; dot: string; chip: string }> = {
  ONLINE: {
    label: 'Online',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  IDLE: {
    label: 'Idle',
    dot: 'bg-amber-500',
    chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  OFFLINE: {
    label: 'Offline',
    dot: 'bg-slate-400',
    chip: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  },
  BELUM_LOGIN: {
    label: 'Belum masuk',
    dot: 'bg-slate-300',
    chip: 'bg-muted text-muted-foreground',
  },
  DICABUT: {
    label: 'Dicabut',
    dot: 'bg-red-500',
    chip: 'bg-red-500/15 text-red-700 dark:text-red-300',
  },
};

/** Monitor realtime satu sesi (SSE `GET /sesi/:id/monitor`). */
export function useMonitor(sesiId: string | null) {
  return useSse<MonitorSnapshot>(sesiId ? `/sesi/${sesiId}/monitor` : null);
}
