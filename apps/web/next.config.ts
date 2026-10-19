import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

const coreUrl = process.env.CORE_URL ?? 'http://localhost:3001';
const acaraUrl = process.env.ACARA_URL ?? 'http://localhost:3002';

// Service worker untuk PWA operator (/op): app shell + model wajah tersedia offline.
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  register: false,
  disable: process.env.NODE_ENV !== 'production',
  additionalPrecacheEntries: [{ url: '/op', revision: String(Date.now()) }],
});

const nextConfig: NextConfig = {
  transpilePackages: ['@platform-acara/shared', '@platform-acara/face'],
  // face-api membawa jalur Node (require dinamis) yang tidak dipakai di browser.
  webpack(config: { ignoreWarnings?: unknown[] }) {
    config.ignoreWarnings = [...(config.ignoreWarnings ?? []), { module: /@vladmandic\/face-api/ }];
    return config;
  },
  // Dev & tanpa gateway: /api/core/* → core-svc, /api/acara/* → acara-svc.
  async rewrites() {
    return [
      { source: '/api/core/:path*', destination: `${coreUrl}/:path*` },
      { source: '/api/acara/:path*', destination: `${acaraUrl}/:path*` },
    ];
  },
};

export default withSerwist(nextConfig);
