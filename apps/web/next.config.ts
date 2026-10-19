import type { NextConfig } from 'next';

const coreUrl = process.env.CORE_URL ?? 'http://localhost:3001';
const acaraUrl = process.env.ACARA_URL ?? 'http://localhost:3002';

const nextConfig: NextConfig = {
  transpilePackages: ['@platform-acara/shared', '@platform-acara/face'],
  // Dev & tanpa gateway: /api/core/* → core-svc, /api/acara/* → acara-svc. Di produksi Traefik melayani path yang sama.
  async rewrites() {
    return [
      { source: '/api/core/:path*', destination: `${coreUrl}/:path*` },
      { source: '/api/acara/:path*', destination: `${acaraUrl}/:path*` },
    ];
  },
};

export default nextConfig;
