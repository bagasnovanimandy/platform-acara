'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AcaraDetail } from '@/lib/acara';
import { acaraApi, errorMessage } from '@/lib/api';
import { formatWaktu } from '@/lib/queries';

interface Kehadiran {
  peserta: number;
  hadir: number;
  tamu: number;
  operator: { id: string; label: string; lastSeenAt: string | null; lastScanAt: string | null }[];
  items: {
    id: string;
    metode: 'WAJAH' | 'MANUAL' | 'TAMU';
    capturedAt: string;
    terlambat: boolean;
    perluTinjau: boolean;
    pintu: string | null;
    anggota: { kode: string; nama: string; namaKelompok: string } | null;
    tamu: string | null;
  }[];
}

const METODE: Record<Kehadiran['items'][number]['metode'], string> = {
  WAJAH: 'Wajah',
  MANUAL: 'Cari nama',
  TAMU: 'Tamu',
};

export function KehadiranTab({ acara }: { acara: AcaraDetail }) {
  const [sesiId, setSesiId] = useState(acara.sesi[0]?.id ?? '');
  const q = useQuery({
    queryKey: ['kehadiran', sesiId],
    queryFn: () => acaraApi<Kehadiran>(`/sesi/${sesiId}/kehadiran`),
    enabled: !!sesiId,
    refetchInterval: 10_000,
  });

  if (acara.sesi.length === 0)
    return <p className="text-sm text-muted-foreground">Tambahkan sesi dulu.</p>;

  const k = q.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Sesi
          <NativeSelect value={sesiId} onChange={(e) => setSesiId(e.target.value)}>
            {acara.sesi.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button variant="outline" onClick={() => q.refetch()} aria-label="Muat ulang">
          <RefreshCw /> Muat ulang
        </Button>
      </div>

      {q.error && <Alert variant="destructive">{errorMessage(q.error)}</Alert>}
      {k && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="py-4">
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums" data-testid="hadir">
                  {k.hadir.toLocaleString('id-ID')}
                </div>
                <div className="text-xs text-muted-foreground">
                  hadir dari {k.peserta.toLocaleString('id-ID')} peserta
                </div>
              </CardContent>
            </Card>
            <Card className="py-4">
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">{k.tamu}</div>
                <div className="text-xs text-muted-foreground">tamu</div>
              </CardContent>
            </Card>
            <Card className="py-4">
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">{k.operator.length}</div>
                <div className="text-xs text-muted-foreground">perangkat pintu</div>
              </CardContent>
            </Card>
          </div>

          {k.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada yang tercatat hadir.</p>
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Cara</TableHead>
                    <TableHead>Pintu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...k.items].reverse().map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatWaktu(i.capturedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{i.anggota?.nama ?? i.tamu ?? '-'}</div>
                        {i.anggota && (
                          <div className="text-xs text-muted-foreground">
                            {i.anggota.kode} · {i.anggota.namaKelompok}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary">{METODE[i.metode]}</Badge>
                          {i.terlambat && <Badge variant="outline">Terlambat</Badge>}
                          {i.perluTinjau && <Badge variant="outline">Perlu ditinjau</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{i.pintu ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
