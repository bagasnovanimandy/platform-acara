import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SwRegister } from './sw-register';

export const metadata: Metadata = {
  title: 'Absensi Pintu',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function OpLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-black text-white">
      <SwRegister />
      {children}
    </div>
  );
}
