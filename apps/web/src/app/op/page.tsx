'use client';

import { QrCode } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { OperatorApp } from '@/components/op/operator-app';
import { bacaSesi, hapusSesi } from '@/lib/op/session';
import type { OpSession } from '@/lib/op/types';

export default function OperatorPage() {
  const [session, setSession] = useState<OpSession | null | undefined>(undefined);
  useEffect(() => setSession(bacaSesi()), []);
  const onExpired = useCallback(() => {
    hapusSesi();
    setSession(null);
  }, []);

  if (session === undefined) return null;
  if (!session)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <QrCode className="size-16 text-white/60" aria-hidden />
        <h1 className="text-2xl font-semibold">Perangkat belum terhubung</h1>
        <p className="max-w-sm text-lg text-white/70">
          Pindai QR perangkat pintu dari admin acara untuk mulai mencatat kehadiran.
        </p>
      </main>
    );
  return <OperatorApp session={session} onExpired={onExpired} />;
}
