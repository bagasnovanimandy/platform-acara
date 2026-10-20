'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, errorMessage, refreshSession } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { bukaSiku } from '@/lib/siku';

/**
 * Jembatan ke SiKU: dibuka dari menu "Keuangan (SiKU)" atau tombol "Masuk lewat Platform
 * Acara" di halaman login SiKU. Belum login → ke /login lalu kembali ke sini.
 */
export default function KeuanganPage() {
  const { status } = useAuth();
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unknown') void refreshSession();
    if (status === 'anonymous') router.replace('/login?next=/keuangan');
    if (status !== 'authenticated' || started.current) return;
    started.current = true;
    bukaSiku().catch((err: unknown) => {
      setError(
        err instanceof ApiError && err.code === 'SIKU_NO_ACCESS'
          ? 'Akun Anda belum terhubung ke SiKU. Minta bendahara atau admin SiKU menjalankan sinkronisasi pengguna.'
          : err instanceof ApiError && err.code === 'SIKU_NOT_CONFIGURED'
            ? 'Alamat SiKU belum diatur di platform.'
            : errorMessage(err),
      );
    });
  }, [status, router]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Keuangan (SiKU)</CardTitle>
          <CardDescription>Membuka SiKU dengan akun platform Anda</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <>
              <Alert variant="destructive" data-testid="siku-error">
                {error}
              </Alert>
              <Link href="/admin" className={buttonVariants({ variant: 'outline' })}>
                Kembali ke Platform Acara
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted-foreground" role="status">
              Mengalihkan ke SiKU…
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
