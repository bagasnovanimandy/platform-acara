'use client';

import { useQuery } from '@tanstack/react-query';
import { useReducedMotion } from 'motion/react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { BatangStatus } from '@/components/rekap-tab';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { acaraApi, errorMessage } from '@/lib/api';
import { useKategori } from '@/lib/queries';
import { persen, type Ringkasan, STATUS_INFO, STATUS_REKAP } from '@/lib/rekap';
import { AXIS, ChartCard, Legend, StatTile, TooltipBox } from './chart-card';
import { labelBulan } from './charts';
import { Reveal, RevealItem } from './motion';

interface StatistikKehadiran {
  ringkas: Ringkasan;
  perBulan: (Ringkasan & { bulan: string })[];
  perKategori: (Ringkasan & { kode: string })[];
  sesiTerbaru: {
    id: string;
    nama: string;
    mulai: string;
    acara: { id: string; nama: string };
    ringkas: Ringkasan;
  }[];
}

type BulanRow = StatistikKehadiran['perBulan'][number];

const tanggal = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso));

function PerBulanChart({ data }: { data: BulanRow[] }) {
  const anim = !useReducedMotion();
  return (
    <ChartCard
      title="Kehadiran per bulan"
      description="Status peserta di sesi yang sudah ditutup, 6 bulan terakhir."
      table={{
        head: ['Bulan', ...STATUS_REKAP.map((s) => STATUS_INFO[s].label), '% Hadir'],
        rows: data.map((b) => [
          labelBulan(b.bulan),
          ...STATUS_REKAP.map((s) => b[s]),
          persen(b.persenHadir),
        ]),
      }}
    >
      <Legend items={STATUS_REKAP.map((s) => STATUS_INFO[s])} />
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="bulan" tickFormatter={labelBulan} minTickGap={8} {...AXIS} />
            <YAxis
              allowDecimals={false}
              tickFormatter={(n: number) =>
                n.toLocaleString('id-ID', { notation: 'compact', maximumFractionDigits: 1 })
              }
              {...AXIS}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--accent)' }}
              content={({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
                // Batas library: recharts mengetik payload sebagai `any`.
                const d = payload?.[0]?.payload as BulanRow | undefined;
                return active && d ? (
                  <TooltipBox
                    title={`${labelBulan(d.bulan)} · ${persen(d.persenHadir)} hadir`}
                    rows={STATUS_REKAP.map((s) => ({
                      label: STATUS_INFO[s].label,
                      value: d[s],
                      color: STATUS_INFO[s].color,
                    }))}
                  />
                ) : null;
              }}
            />
            {STATUS_REKAP.map((s, i) => (
              <Bar
                key={s}
                isAnimationActive={anim}
                dataKey={s}
                stackId="status"
                fill={STATUS_INFO[s].color}
                stroke="var(--card)"
                strokeWidth={2}
                maxBarSize={28}
                radius={i === STATUS_REKAP.length - 1 ? [4, 4, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function PerKategori({ rows }: { rows: StatistikKehadiran['perKategori'] }) {
  const kategori = useKategori();
  const nama = new Map((kategori.data?.items ?? []).map((k) => [k.kode, k.nama]));
  return (
    <Card className="h-full gap-3">
      <CardHeader>
        <CardTitle>Per kategori</CardTitle>
        <CardDescription>
          Anggota dengan beberapa kategori dihitung di tiap kategorinya.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada sesi yang ditutup.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.kode} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {r.kode === 'BELUM' ? 'Belum berkategori' : (nama.get(r.kode) ?? r.kode)}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {persen(r.persenHadir)} dari {r.peserta.toLocaleString('id-ID')}
                  </span>
                </div>
                <BatangStatus r={r} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SesiTerbaru({ items }: { items: StatistikKehadiran['sesiTerbaru'] }) {
  return (
    <Card className="h-full gap-3">
      <CardHeader>
        <CardTitle>Sesi terakhir ditutup</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada sesi yang ditutup.</p>
        ) : (
          <ul className="divide-y">
            {items.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/admin/acara/${s.acara.id}?tab=rekap`}
                  className="-mx-2 flex flex-col gap-1.5 rounded-md px-2 py-2.5 hover:bg-accent"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      {s.acara.nama} · {s.nama}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums">
                      {persen(s.ringkas.persenHadir)}
                    </span>
                  </span>
                  <BatangStatus r={s.ringkas} />
                  <span className="text-xs text-muted-foreground">
                    {tanggal(s.mulai)} · {s.ringkas.HADIR} hadir, {s.ringkas.IZIN + s.ringkas.SAKIT}{' '}
                    izin/sakit, {s.ringkas.ALPHA} alpha
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Bagian "Kehadiran" di dashboard, dari rekap sesi yang sudah ditutup (12 bulan). */
export function KehadiranStats() {
  const q = useQuery({
    queryKey: ['dashboard', 'kehadiran'],
    queryFn: () => acaraApi<StatistikKehadiran>('/dashboard/kehadiran'),
  });
  if (q.error) return <Alert variant="destructive">{errorMessage(q.error)}</Alert>;
  const s = q.data;
  if (!s) return <div className="h-24 animate-pulse rounded-xl bg-muted" aria-busy />;
  const k = s.ringkas;
  return (
    <div className="flex flex-col gap-4">
      <Reveal className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RevealItem>
          <StatTile
            label="Kehadiran"
            value={k.persenHadir}
            format={persen}
            hint={`${k.HADIR.toLocaleString('id-ID')} dari ${k.peserta.toLocaleString('id-ID')}`}
          />
        </RevealItem>
        <RevealItem>
          <StatTile label="Izin & sakit" value={k.IZIN + k.SAKIT} hint={`${k.SAKIT} sakit`} />
        </RevealItem>
        <RevealItem>
          <StatTile label="Alpha" value={k.ALPHA} hint="tanpa izin yang disetujui" />
        </RevealItem>
        <RevealItem>
          <StatTile label="Terlambat" value={k.terlambat} hint="dari yang hadir" />
        </RevealItem>
      </Reveal>
      <Reveal className="grid gap-4 lg:grid-cols-3">
        <RevealItem className="lg:col-span-3">
          <PerBulanChart data={s.perBulan} />
        </RevealItem>
        <RevealItem className="lg:col-span-2">
          <SesiTerbaru items={s.sesiTerbaru} />
        </RevealItem>
        <RevealItem>
          <PerKategori rows={s.perKategori} />
        </RevealItem>
      </Reveal>
    </div>
  );
}
