import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@platform-acara/shared', '@platform-acara/face'],
};

export default nextConfig;
