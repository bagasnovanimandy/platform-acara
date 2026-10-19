/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      // Model face-api (±7 MB) jarang berubah.
      matcher: ({ url }) => url.pathname.startsWith('/models/'),
      handler: new CacheFirst({
        cacheName: 'face-models',
        plugins: [new ExpirationPlugin({ maxEntries: 20 })],
      }),
    },
    {
      // Halaman operator: coba jaringan, jatuh ke cache saat offline.
      matcher: ({ request, url }) => request.mode === 'navigate' && url.pathname.startsWith('/op'),
      handler: new NetworkFirst({ cacheName: 'op-pages', networkTimeoutSeconds: 3 }),
    },
  ],
  // API (/api/*) sengaja tidak di-cache: data offline disimpan aplikasi di IndexedDB.
});

serwist.addEventListeners();
