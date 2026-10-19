'use client';

import { useEffect, useState } from 'react';
import { ACARA, ApiError, apiStream } from './api';

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

/**
 * Langganan SSE `GET /sesi/:id/monitor`. Dibaca lewat fetch (bukan EventSource) agar bisa
 * mengirim header Authorization. Tersambung ulang otomatis bila putus.
 */
export function useMonitor(sesiId: string | null) {
  const [data, setData] = useState<MonitorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tersambung, setTersambung] = useState(false);

  useEffect(() => {
    if (!sesiId) return;
    const ctl = new AbortController();
    setData(null);
    let tunda: ReturnType<typeof setTimeout> | undefined;

    const sambung = async () => {
      try {
        const res = await apiStream(`/sesi/${sesiId}/monitor`, ACARA, ctl.signal);
        const reader = res.body?.getReader();
        if (!reader) throw new Error('Stream tidak tersedia');
        setTersambung(true);
        setError(null);
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const blok = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const baris = blok.split('\n').find((l) => l.startsWith('data:'));
            if (baris) setData(JSON.parse(baris.slice(5)) as MonitorSnapshot);
          }
        }
      } catch (e) {
        if (ctl.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Koneksi monitor terputus');
        // Tidak berhak / sesi tidak ada: jangan coba lagi.
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) return;
      }
      if (ctl.signal.aborted) return;
      setTersambung(false);
      tunda = setTimeout(() => void sambung(), 3000);
    };
    void sambung();
    return () => {
      ctl.abort();
      clearTimeout(tunda);
    };
  }, [sesiId]);

  return { data, error, tersambung };
}
