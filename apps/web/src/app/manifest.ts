import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Absensi Pintu — Platform Acara',
    short_name: 'Absensi',
    description: 'Absensi wajah offline untuk penjaga pintu',
    start_url: '/op',
    scope: '/op',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
