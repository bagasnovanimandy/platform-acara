import withSerwistInit from '@serwist/next';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

const coreUrl = process.env.CORE_URL ?? 'http://localhost:3001';
const acaraUrl = process.env.ACARA_URL ?? 'http://localhost:3002';
const wabotUrl = process.env.WABOT_URL ?? 'http://localhost:3003';

// Service worker untuk PWA operator (/op): app shell + model wajah tersedia offline.
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  register: false,
  disable: process.env.NODE_ENV !== 'production',
  additionalPrecacheEntries: [{ url: '/op', revision: String(Date.now()) }],
});

const nextConfig: NextConfig = {
  // Image Docker (apps/web/Dockerfile) memakai output standalone; dev & CI tidak.
  ...(process.env.NEXT_OUTPUT === 'standalone'
    ? { output: 'standalone' as const, outputFileTracingRoot: resolve(process.cwd(), '../..') }
    : {}),
  transpilePackages: ['@platform-acara/shared', '@platform-acara/face'],
  // face-api membawa jalur Node (require dinamis) yang tidak dipakai di browser.
  webpack(config: { ignoreWarnings?: unknown[] }) {
    config.ignoreWarnings = [...(config.ignoreWarnings ?? []), { module: /@vladmandic\/face-api/ }];
    return config;
  },
  // Dev & tanpa gateway: /api/core/* → core-svc, /api/acara/* → acara-svc, /api/wabot/* → wabot-svc.
  async rewrites() {
    return [
      { source: '/api/core/:path*', destination: `${coreUrl}/:path*` },
      { source: '/api/acara/:path*', destination: `${acaraUrl}/:path*` },
      { source: '/api/wabot/:path*', destination: `${wabotUrl}/:path*` },
    ];
  },
};

export default withSerwist(nextConfig);
