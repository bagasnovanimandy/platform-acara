'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { errorMessage, wabotApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { StatusWa } from '@/lib/izin';
import { formatWaktu } from '@/lib/queries';
import { cn } from '@/lib/utils';

const KEADAAN: Record<StatusWa['keadaan'], { label: string; className: string }> = {
  TERHUBUNG: {
    label: 'Terhubung',
    className: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200',
  },
  MENUNGGU_QR: {
    label: 'Menunggu dipindai',
    className: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
  },
  MENYAMBUNG: { label: 'Menyambung…', className: '' },
  TERPUTUS: {
    label: 'Terputus',
    className: 'bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-200',
  },
};

export default function WhatsAppPage() {
  const user = useAuth((s) => s.user);
  const superAdmin = user?.role === 'SUPER_ADMIN';
  const qc = useQueryClient();
  const st = useQuery({
    queryKey: ['wa', 'status'],
    queryFn: () => wabotApi<StatusWa>('/wa/status'),
    refetchInterval: (q) => (q.state.data?.keadaan === 'TERHUBUNG' ? 15_000 : 3_000),
  });
  const [qr, setQr] = useState<string | null>(null);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = st.data;

  useEffect(() => {
    if (!s?.qr) {
      setQr(null);
      return;
    }
    void QRCode.toDataURL(s.qr, { margin: 1, width: 320 }).then(setQr);
  }, [s?.qr]);

  async function tautkan() {
    setBusy(true);
    setError(null);
    try {
      const baru = await wabotApi<StatusWa>('/wa/pair', { method: 'POST' });
      qc.setQueryData(['wa', 'status'], baru);
      setKonfirmasi(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Bot WhatsApp menerima pengajuan izin dan meneruskannya ke PJ izin. Pakai nomor khusus bot,
          bukan nomor pribadi.
        </p>
      </div>
      {st.error && <Alert variant="destructive">{errorMessage(st.error)}</Alert>}
      {s && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Smartphone className="size-5" aria-hidden /> Status bot
              <Badge
                variant="secondary"
                className={KEADAAN[s.keadaan].className}
                data-testid="status-wa"
              >
                {KEADAAN[s.keadaan].label}
              </Badge>
            </CardTitle>
            <CardDescription>
              {s.nomor ? `Nomor bot ${s.nomor} · ` : ''}sejak {formatWaktu(s.sejak)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {s.driver === 'fake' && (
              <Alert>Mode uji: bot tidak tersambung ke WhatsApp sungguhan.</Alert>
            )}
            {s.pesan && s.driver !== 'fake' && <p className="text-sm">{s.pesan}</p>}
            {s.keadaan === 'MENUNGGU_QR' && (
              <div className="flex flex-wrap items-start gap-6">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qr}
                    alt="Kode QR untuk menautkan nomor bot"
                    className="size-64 rounded-md border bg-white p-2"
                  />
                ) : (
                  <div className="size-64 animate-pulse rounded-md bg-muted" />
                )}
                <ol className="flex max-w-xs list-decimal flex-col gap-2 pl-5 text-sm">
                  <li>Buka WhatsApp di HP nomor bot.</li>
                  <li>Ketuk menu, lalu Perangkat tertaut, lalu Tautkan perangkat.</li>
                  <li>Pindai kode ini. Kode berganti sendiri tiap beberapa detik.</li>
                </ol>
              </div>
            )}
            {superAdmin && s.driver !== 'fake' && (
              <div>
                <Button variant="outline" size="lg" onClick={() => setKonfirmasi(true)}>
                  <RefreshCw /> Tautkan ulang
                </Button>
              </div>
            )}
            {error && !konfirmasi && <Alert variant="destructive">{error}</Alert>}
          </CardContent>
        </Card>
      )}

      {konfirmasi && (
        <Dialog open onOpenChange={(o) => !o && setKonfirmasi(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tautkan ulang nomor bot?</DialogTitle>
              <DialogDescription>
                Sesi WhatsApp yang sekarang diputus dan kode QR baru ditampilkan. Selama belum
                dipindai, bot tidak menerima pesan.
              </DialogDescription>
            </DialogHeader>
            {error && <Alert variant="destructive">{error}</Alert>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setKonfirmasi(false)}>
                Batal
              </Button>
              <Button
                disabled={busy}
                onClick={() => void tautkan()}
                className={cn(busy && 'opacity-70')}
              >
                {busy ? 'Memutus…' : 'Tautkan ulang'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
