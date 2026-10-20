'use client';

import { useEffect, useState } from 'react';
import { ACARA, apiBlob } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Gambar yang butuh token: diambil sebagai blob lalu ditampilkan lewat object URL. */
export function AuthImage({
  path,
  alt,
  className,
}: {
  path: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    void apiBlob(path, ACARA).then((b) => {
      if (!alive) return;
      url = URL.createObjectURL(b);
      setSrc(url);
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  if (!src) return <div className={cn('aspect-square w-full animate-pulse bg-muted', className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={cn('aspect-square w-full object-cover', className)} />;
}
