'use client';

import { useEffect } from 'react';

/** Daftarkan service worker (hanya build produksi; di dev Serwist dinonaktifkan). */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);
  return null;
}
