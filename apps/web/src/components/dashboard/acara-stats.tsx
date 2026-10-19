'use client';

import { useQuery } from '@tanstack/react-query';
import { useReducedMotion } from 'motion/react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { StatusChip, TingkatChip } from '@/components/acara-bits';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatJam, type StatusAcara, type Tingkat, TINGKAT_LABEL } from '@/lib/acara';
import { acaraApi, errorMessage } from '@/lib/api';
import { AXIS, ChartCard, Legend, StatTile, TooltipBox } from './chart-card';
import { labelBulan } from './charts';
import { Reveal, RevealItem } from './motion';

interface StatistikAcara {
  total: number;
  bulanIni: number;
  akanDatang: number;
  sesi: number;
  status: Record<StatusAcara, number>;
  tingkat: Record<Tingkat, number>;
  perBulan: { bulan: string; jumlah: number; lewat: boolean }[];
  terdekat: {
    id: string;
    nama: string;
    status: StatusAcara;
    tingkat: Tingkat;
    lokasi: string | null;
    tanggalMulai: string;
  }[];
}

type BulanRow = StatistikAcara['perBulan'][number];

const tanggal = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso));

function PerBulanChart({ data }: { data: BulanRow[] }) {
  const anim = !useReducedMotion();
  return (
    <ChartCard
      title="Acara per bulan"
      description="6 bulan terakhir dan 5 bulan ke depan, tanpa acara batal."
      table={{
        head: ['Bulan', 'Acara'],
        rows: data.map((b) => [labelBulan(b.bulan), b.jumlah]),
      }}
    >
      <Legend
        items={[
          { label: 'Sudah lewat', color: 'var(--chart-1)' },
          { label: 'Bulan ini & mendatang', color: 'var(--chart-3)' },
        ]}
      />
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="bulan" tickFormatter={labelBulan} minTickGap={8} {...AXIS} />
            <YAxis allowDecimals={false} {...AXIS} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--accent)' }}
              content={({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
                // Batas library: recharts mengetik payload sebagai `any`.
                const d = payload?.[0]?.payload as BulanRow | undefined;
                return active && d ? (
                  <TooltipBox
                    title={labelBulan(d.bulan)}
                    rows={[
                      {
                        label: 'Acara',
                        value: d.jumlah,
                        color: d.lewat ? 'var(--chart-1)' : 'var(--chart-3)',
                      },
                    ]}
                  />
                ) : null;
              }}
            />
            <Bar isAnimationActive={anim} dataKey="jumlah" maxBarSize={22} radius={[4, 4, 0, 0]}>
              {data.map((b) => (
                <Cell key={b.bulan} fill={b.lewat ? 'var(--chart-1)' : 'var(--chart-3)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function Terdekat({ items }: { items: StatistikAcara['terdekat'] }) {
  return (
    <Card className="h-full gap-3">
      <CardHeader>
        <CardTitle>Acara terdekat</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada acara yang dijadwalkan.</p>
        ) : (
          <ul className="divide-y">
            {items.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/acara/${a.id}`}
                  className="-mx-2 flex flex-col gap-1 rounded-md px-2 py-2.5 hover:bg-accent"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{a.nama}</span>
                    <StatusChip status={a.status} />
                    <TingkatChip tingkat={a.tingkat} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {tanggal(a.tanggalMulai)}, {formatJam(a.tanggalMulai)} WIB
                    {a.lokasi && ` · ${a.lokasi}`}
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

/** Bagian "Acara" di dashboard: angka utama, acara per bulan, dan acara terdekat. */
export function AcaraStats() {
  const q = useQuery({
    queryKey: ['dashboard', 'acara'],
    queryFn: () => acaraApi<StatistikAcara>('/dashboard/acara'),
  });
  if (q.error) return <Alert variant="destructive">{errorMessage(q.error)}</Alert>;
  const s = q.data;
  if (!s) return <div className="h-24 animate-pulse rounded-xl bg-muted" aria-busy />;
  const tingkatTerbanyak = (Object.entries(s.tingkat) as [Tingkat, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${n} ${TINGKAT_LABEL[t].toLowerCase()}`)
    .join(' · ');
  return (
    <div className="flex flex-col gap-4">
      <Reveal className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RevealItem>
          <StatTile label="Acara bulan ini" value={s.bulanIni} hint="tanpa acara batal" />
        </RevealItem>
        <RevealItem>
          <StatTile label="Akan datang" value={s.akanDatang} hint="belum selesai atau batal" />
        </RevealItem>
        <RevealItem>
          <StatTile label="Total acara" value={s.total} hint={tingkatTerbanyak || 'belum ada'} />
        </RevealItem>
        <RevealItem>
          <StatTile label="Total sesi" value={s.sesi} hint="dari semua acara" />
        </RevealItem>
      </Reveal>
      <Reveal className="grid gap-4 lg:grid-cols-2">
        <RevealItem>
          <PerBulanChart data={s.perBulan} />
        </RevealItem>
        <RevealItem>
          <Terdekat items={s.terdekat} />
        </RevealItem>
      </Reveal>
    </div>
  );
}
