'use client';

import { KeyRound, QrCode } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { OperatorApp } from '@/components/op/operator-app';
import { loginOperatorPin, OpError } from '@/lib/op/api';
import { bacaSesi, hapusSesi, simpanSesi } from '@/lib/op/session';
import type { OpSession } from '@/lib/op/types';

const inputCls =
  'h-16 w-full rounded-2xl bg-white/10 px-4 text-center text-2xl font-semibold tracking-[0.3em] text-white uppercase placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:normal-case placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/60';

function LoginPin({ pesan, onMasuk }: { pesan: string | null; onMasuk: (s: OpSession) => void }) {
  const [kode, setKode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(pesan);
  const [busy, setBusy] = useState(false);
  const ok = kode.replace(/[^a-z0-9]/gi, '').length === 6 && /^\d{6}$/.test(pin);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      const s = await loginOperatorPin(kode, pin);
      simpanSesi(s);
      onMasuk(s);
    } catch (err) {
      setPin('');
      if (err instanceof OpError) setError(err.message);
      else setError('Tidak bisa terhubung ke server. Periksa internet lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <QrCode className="size-14 text-white/60" aria-hidden />
        <h1 className="text-2xl font-semibold">Masuk perangkat pintu</h1>
        <p className="text-white/70">
          Pindai QR di kartu pintu, atau ketik kode pintu dan PIN dari admin.
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          value={kode}
          onChange={(e) => setKode(e.target.value.toUpperCase().slice(0, 8))}
          placeholder="Kode pintu"
          aria-label="Kode pintu"
          autoComplete="off"
          autoCapitalize="characters"
          className={inputCls}
        />
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="PIN 6 angka"
          aria-label="PIN"
          inputMode="numeric"
          type="password"
          autoComplete="off"
          className={inputCls}
        />
        {error && (
          <p role="alert" className="rounded-xl bg-red-500/15 px-4 py-3 text-center text-red-200">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!ok || busy}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-white text-lg font-semibold text-black disabled:opacity-40"
        >
          <KeyRound className="size-5" aria-hidden />
          {busy ? 'Memeriksa…' : 'Masuk'}
        </button>
      </form>
    </main>
  );
}

export default function OperatorPage() {
  const [session, setSession] = useState<OpSession | null | undefined>(undefined);
  const [pesan, setPesan] = useState<string | null>(null);
  useEffect(() => setSession(bacaSesi()), []);
  const onExpired = useCallback((alasan?: string) => {
    hapusSesi();
    setPesan(alasan ?? 'Login perangkat berakhir. Masuk lagi dengan QR atau PIN.');
    setSession(null);
  }, []);

  if (session === undefined) return null;
  if (!session) return <LoginPin pesan={pesan} onMasuk={setSession} />;
  return <OperatorApp session={session} onExpired={onExpired} />;
}
