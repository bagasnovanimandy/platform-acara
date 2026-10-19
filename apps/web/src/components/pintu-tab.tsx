'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BatteryMedium,
  Copy,
  DoorOpen,
  KeyRound,
  Keyboard,
  Printer,
  Radio,
  ShieldOff,
  Smartphone,
} from 'lucide-react';
import QRCode from 'qrcode';
import { type FormEvent, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { AcaraDetail } from '@/lib/acara';
import { acaraApi, errorMessage } from '@/lib/api';
import { type KartuPintu, type Pintu, STATUS_PINTU, useMonitor } from '@/lib/pintu';
import { cn } from '@/lib/utils';

const jam = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      })
    : '-';

/** Nama perangkat singkat dari user agent. */
function namaPerangkat(ua: string | null): string | null {
  if (!ua) return null;
  const android = /Android[^;)]*;\s*([^;)]+?)(?:\s+Build|\))/.exec(ua);
  if (android?.[1]) return android[1].trim();
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux';
  return ua.slice(0, 24);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Kartu QR + kode + PIN siap cetak di jendela baru. */
async function cetakKartu(kartu: KartuPintu[], judul: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  const isi = await Promise.all(
    kartu.map(async (k) => {
      const url = `${window.location.origin}${k.url}`;
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 360 });
      return `<div class="k"><h2>${esc(k.label)}</h2><p class="j">${esc(judul)}</p>
        <img src="${qr}" alt="QR ${esc(k.label)}"/>
        <p>Kode pintu <b>${esc(k.kode)}</b></p><p>PIN <b>${esc(k.pin)}</b></p>
        <p class="s">Pindai QR sekali, atau buka ${esc(window.location.host)}/op lalu isi kode & PIN.</p></div>`;
    }),
  );
  w.document
    .write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Kartu pintu</title>
    <style>body{font-family:system-ui,sans-serif;margin:16px}.g{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
    .k{border:1px dashed #888;border-radius:12px;padding:16px;text-align:center;break-inside:avoid}
    h2{margin:0;font-size:22px}.j{margin:4px 0 8px;color:#555;font-size:13px}img{width:180px;height:180px}
    p{margin:4px 0;font-size:16px}b{font-size:20px;letter-spacing:.15em}.s{font-size:11px;color:#666}
    @media print{body{margin:0}}</style></head><body><div class="g">${isi.join('')}</div>
    <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

function teksKartu(k: KartuPintu, judul: string) {
  return `${judul}\n${k.label}\nBuka: ${window.location.origin}${k.url}\nAtau ${window.location.origin}/op dengan kode ${k.kode} dan PIN ${k.pin}`;
}

function KartuDialog({
  kartu,
  judul,
  onClose,
}: {
  kartu: KartuPintu[];
  judul: string;
  onClose: () => void;
}) {
  const [qr, setQr] = useState<Record<string, string>>({});
  useEffect(() => {
    void Promise.all(
      kartu.map(
        async (k) =>
          [
            k.id,
            await QRCode.toDataURL(`${window.location.origin}${k.url}`, { margin: 1 }),
          ] as const,
      ),
    ).then((pairs) => setQr(Object.fromEntries(pairs)));
  }, [kartu]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kartu pintu</DialogTitle>
          <DialogDescription>
            PIN hanya tampil sekarang. Cetak atau salin sebelum menutup. QR berlaku 24 jam dan
            sekali pakai; setelah itu masuk dengan kode pintu dan PIN.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {kartu.map((k) => (
            <div
              key={k.id}
              className="flex items-center gap-3 rounded-lg border p-3"
              data-testid="kartu-pintu"
            >
              {qr[k.id] ? (
                <img src={qr[k.id]} alt={`QR ${k.label}`} className="size-24 shrink-0" />
              ) : (
                <div className="size-24 shrink-0 animate-pulse rounded bg-muted" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="font-semibold">{k.label}</div>
                <div className="text-sm">
                  Kode <span className="font-mono font-semibold tracking-wider">{k.kode}</span>
                </div>
                <div className="text-sm">
                  PIN{' '}
                  <span className="font-mono font-semibold tracking-wider" data-testid="pin">
                    {k.pin}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => navigator.clipboard?.writeText(teksKartu(k, judul))}
                >
                  <Copy /> Salin
                </Button>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
          <Button onClick={() => void cetakKartu(kartu, judul)}>
            <Printer /> Cetak kartu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ItemKehadiran {
  id: string;
  metode: 'WAJAH' | 'MANUAL' | 'TAMU';
  capturedAt: string;
  terlambat: boolean;
  pintu: string | null;
  anggota: { kode: string; nama: string; namaKelompok: string } | null;
  tamu: string | null;
}

function InputPintuDialog({
  sesiId,
  pintu,
  onClose,
}: {
  sesiId: string;
  pintu: Pintu;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ['kehadiran', sesiId],
    queryFn: () => acaraApi<{ items: ItemKehadiran[] }>(`/sesi/${sesiId}/kehadiran`),
  });
  const items = (q.data?.items ?? []).filter((i) => i.pintu === pintu.label).reverse();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dicatat di {pintu.label}</DialogTitle>
          <DialogDescription>
            {items.length} kehadiran tersimpan. Scan ganda yang kalah waktu tidak ditampilkan.
          </DialogDescription>
        </DialogHeader>
        {q.error && <Alert variant="destructive">{errorMessage(q.error)}</Alert>}
        <ul className="divide-y text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2">
              <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                {jam(i.capturedAt)}
              </span>
              <span className="min-w-0 flex-1 truncate">{i.anggota?.nama ?? i.tamu}</span>
              <Badge variant="secondary">
                {i.metode === 'WAJAH' ? 'Wajah' : i.metode === 'MANUAL' ? 'Cari nama' : 'Tamu'}
              </Badge>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function KartuStatus({
  p,
  bisaKelola,
  onBuka,
  onReset,
  onCabut,
}: {
  p: Pintu;
  bisaKelola: boolean;
  onBuka: () => void;
  onReset: () => void;
  onCabut: () => void;
}) {
  const st = STATUS_PINTU[p.status];
  const perangkat = namaPerangkat(p.perangkat);
  return (
    <Card className={cn('gap-3 py-4', p.status === 'DICABUT' && 'opacity-60')} data-testid="pintu">
      <CardContent className="flex flex-col gap-3">
        <button type="button" onClick={onBuka} className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-semibold">
              <DoorOpen className="size-4 text-muted-foreground" aria-hidden />
              {p.label}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                st.chip,
              )}
              data-testid="status-pintu"
            >
              <span className={cn('size-2 rounded-full', st.dot)} aria-hidden />
              {st.label}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xl font-semibold tabular-nums" data-testid="jumlah-input">
                {p.jumlahInput}
              </div>
              <div className="text-xs text-muted-foreground">input</div>
            </div>
            <div>
              <div className="text-xl font-semibold tabular-nums">{jam(p.lastScanAt)}</div>
              <div className="text-xs text-muted-foreground">scan terakhir</div>
            </div>
            <div>
              <div
                className={cn(
                  'text-xl font-semibold tabular-nums',
                  p.antrean > 0 && 'text-amber-600 dark:text-amber-400',
                )}
              >
                {p.antrean}
              </div>
              <div className="text-xs text-muted-foreground">belum terkirim</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {p.status === 'OFFLINE' && <span>Terakhir terlihat {jam(p.lastSeenAt)}</span>}
            {perangkat && (
              <span className="inline-flex items-center gap-1">
                <Smartphone className="size-3.5" aria-hidden /> {perangkat}
              </span>
            )}
            {p.baterai !== null && (
              <span className="inline-flex items-center gap-1">
                <BatteryMedium className="size-3.5" aria-hidden /> {p.baterai}%
              </span>
            )}
            {p.sedangInput && p.status !== 'OFFLINE' && (
              <span className="inline-flex items-center gap-1">
                <Keyboard className="size-3.5" aria-hidden /> sedang mengetik
              </span>
            )}
            <span>
              Kode <span className="font-mono">{p.kode}</span>
            </span>
          </div>
        </button>
        {bisaKelola && p.status !== 'DICABUT' && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onReset}>
              <KeyRound /> Reset PIN
            </Button>
            <Button variant="ghost" size="sm" onClick={onCabut}>
              <ShieldOff /> Cabut
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Tab "Pintu": buat pintu (QR/PIN), monitor perangkat realtime, cabut, reset PIN. */
export function PintuTab({ acara }: { acara: AcaraDetail }) {
  const [sesiId, setSesiId] = useState(acara.sesi[0]?.id ?? '');
  const sesi = acara.sesi.find((s) => s.id === sesiId);
  const { data, error: monitorError, tersambung } = useMonitor(sesiId || null);
  const [jumlah, setJumlah] = useState('2');
  const [kartu, setKartu] = useState<KartuPintu[] | null>(null);
  const [buka, setBuka] = useState<Pintu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (acara.sesi.length === 0)
    return <p className="text-sm text-muted-foreground">Tambahkan sesi dulu.</p>;

  const judul = `${acara.nama} · ${sesi?.nama ?? ''}`;

  async function generate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await acaraApi<{ items: KartuPintu[] }>(`/sesi/${sesiId}/operator/generate`, {
        method: 'POST',
        body: { jumlah: Number(jumlah) },
      });
      setKartu(r.items);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function aksi(p: Pintu, jenis: 'reset' | 'cabut') {
    const tanya =
      jenis === 'reset'
        ? `Buat PIN dan QR baru untuk ${p.label}? PIN lama tidak berlaku, perangkat yang sudah masuk tetap jalan.`
        : `Cabut ${p.label}? Perangkat di pintu ini langsung keluar dan tidak bisa masuk lagi.`;
    if (!confirm(tanya)) return;
    setError(null);
    try {
      if (jenis === 'reset') {
        setKartu([await acaraApi<KartuPintu>(`/operator/${p.id}/reset-pin`, { method: 'POST' })]);
      } else {
        await acaraApi(`/operator/${p.id}/revoke`, { method: 'POST' });
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const pintu = data?.pintu ?? [];
  const hitung = (s: Pintu['status']) => pintu.filter((p) => p.status === s).length;

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
        {acara.bisaKelola && (
          <form onSubmit={generate} className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="jumlah-pintu">Jumlah pintu baru</Label>
              <Input
                id="jumlah-pintu"
                type="number"
                min={1}
                max={20}
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                className="w-24"
              />
            </div>
            <Button type="submit" disabled={busy || !(Number(jumlah) >= 1 && Number(jumlah) <= 20)}>
              <DoorOpen /> Buat pintu
            </Button>
          </form>
        )}
        <span
          className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          aria-live="polite"
        >
          <Radio
            className={cn('size-3.5', tersambung ? 'text-emerald-500' : 'text-slate-400')}
            aria-hidden
          />
          {tersambung ? 'Langsung' : 'Menyambung…'}
        </span>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {monitorError && !tersambung && <Alert variant="destructive">{monitorError}</Alert>}

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Hadir', data.hadir, 'hadir'],
            ['Tamu', data.tamu, 'tamu'],
            ['Pintu online', hitung('ONLINE') + hitung('IDLE'), 'online'],
            ['Pintu offline', hitung('OFFLINE'), 'offline'],
          ].map(([l, v, id]) => (
            <Card key={id} className="py-4">
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums" data-testid={`ringkas-${id}`}>
                  {v}
                </div>
                <div className="text-xs text-muted-foreground">{l}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && pintu.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="text-sm text-muted-foreground">
            Belum ada pintu untuk sesi ini.
            {acara.bisaKelola && ' Isi jumlah pintu lalu tekan "Buat pintu".'}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pintu.map((p) => (
          <KartuStatus
            key={p.id}
            p={p}
            bisaKelola={acara.bisaKelola}
            onBuka={() => setBuka(p)}
            onReset={() => void aksi(p, 'reset')}
            onCabut={() => void aksi(p, 'cabut')}
          />
        ))}
      </div>

      {kartu && <KartuDialog kartu={kartu} judul={judul} onClose={() => setKartu(null)} />}
      {buka && <InputPintuDialog sesiId={sesiId} pintu={buka} onClose={() => setBuka(null)} />}
    </div>
  );
}
