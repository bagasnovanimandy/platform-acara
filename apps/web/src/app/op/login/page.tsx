'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { loginOperator, OpError } from '@/lib/op/api';
import { simpanSesi } from '@/lib/op/session';

const PESAN: Record<string, string> = {
  QR_INVALID: 'QR tidak dikenali atau sudah kedaluwarsa. Masuk dengan kode pintu dan PIN.',
  QR_USED: 'QR ini sudah dipakai di perangkat lain. Masuk dengan kode pintu dan PIN.',
};

function Login() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t = params.get('t');
    if (!t) {
      setError('Tautan tidak berisi token. Pindai QR dari admin.');
      return;
    }
    loginOperator(t)
      .then((s) => {
        simpanSesi(s);
        router.replace('/op');
      })
      .catch((e: unknown) => {
        if (e instanceof OpError) setError(PESAN[e.code ?? ''] ?? e.message);
        else setError('Tidak bisa terhubung ke server. Periksa internet lalu coba lagi.');
      });
  }, [params, router]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      {error ? (
        <>
          <h1 className="text-2xl font-semibold">Gagal masuk</h1>
          <p className="max-w-sm text-lg text-white/70" role="alert">
            {error}
          </p>
          <Link
            href="/op"
            className="flex h-14 items-center rounded-2xl bg-white px-6 text-lg font-semibold text-black"
          >
            Masuk dengan PIN
          </Link>
        </>
      ) : (
        <p className="text-lg text-white/70">Menghubungkan perangkat…</p>
      )}
    </main>
  );
}

export default function OpLoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
