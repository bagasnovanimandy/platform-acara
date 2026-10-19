import type { NextConfig } from 'next';

const coreUrl = process.env.CORE_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  transpilePackages: ['@platform-acara/shared', '@platform-acara/face'],
  // Dev & tanpa gateway: /api/core/* diteruskan ke core-svc. Di produksi Traefik melayani path yang sama.
  async rewrites() {
    return [{ source: '/api/core/:path*', destination: `${coreUrl}/:path*` }];
  },
};

export default nextConfig;
