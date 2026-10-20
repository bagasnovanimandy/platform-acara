'use client';

import { useEffect, useState } from 'react';
import { ACARA, ApiError, apiStream } from './api';

/**
 * Langganan SSE acara-svc. Dibaca lewat fetch (bukan EventSource) agar bisa mengirim
 * header Authorization. Tersambung ulang otomatis bila putus. `path` null = tidak berlangganan.
 */
export function useSse<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tersambung, setTersambung] = useState(false);

  useEffect(() => {
    if (!path) return;
    const ctl = new AbortController();
    setData(null);
    let tunda: ReturnType<typeof setTimeout> | undefined;

    const sambung = async () => {
      try {
        const res = await apiStream(path, ACARA, ctl.signal);
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
            if (baris) setData(JSON.parse(baris.slice(5)) as T);
          }
        }
      } catch (e) {
        if (ctl.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Koneksi realtime terputus');
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
  }, [path]);

  return { data, error, tersambung };
}
