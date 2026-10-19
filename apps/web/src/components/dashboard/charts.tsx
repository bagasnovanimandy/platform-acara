'use client';

import type { KategoriWarna } from '@platform-acara/shared/kategori';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useReducedMotion } from 'motion/react';
import { type ReactNode, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import type { AktivitasAudit, GrupAksi, Ringkasan } from '@/lib/dashboard-types';
import { AXIS, ChartCard, Legend, TooltipBox } from './chart-card';

/** Warna kategori (Tailwind 500, sama dengan titik di chip kategori). */
export const KATEGORI_HEX: Record<KategoriWarna, string> = {
  slate: '#64748b',
  amber: '#f59e0b',
  sky: '#0ea5e9',
  emerald: '#10b981',
  violet: '#8b5cf6',
  indigo: '#6366f1',
  teal: '#14b8a6',
  stone: '#78716c',
  rose: '#f43f5e',
  cyan: '#06b6d4',
  lime: '#65a30d',
  orange: '#f97316',
  fuchsia: '#d946ef',
};

const BULAN = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' });
/** `2026-10` → `Okt 26` */
export const labelBulan = (b: string) =>
  `${BULAN.format(new Date(`${b}-01T00:00:00Z`))} ${b.slice(2, 4)}`;
/** `2026-10-19` → `19/10` */
export const labelHari = (h: string) => `${h.slice(8, 10)}/${h.slice(5, 7)}`;

const BAR = 20;
const rowsHeight = (n: number) => Math.max(120, n * 36 + 24);

/** Batang horizontal: pangkal rata di sumbu, ujung data membulat 4px. */
function barEnd(x: number, y: number, w: number, h: number): string {
  if (w <= 0) return '';
  const r = Math.min(4, w, h / 2);
  return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}h-${w - r}z`;
}

/** Isi tooltip dari baris data di bawah kursor. */
function tip<T>(render: (d: T) => ReactNode) {
  return ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
    // Batas library: recharts mengetik payload sebagai `any`.
    const d = payload?.[0]?.payload as T | undefined;
    return active && d ? render(d) : null;
  };
}

/** Batang horizontal satu seri; klik batang menjalankan `onPick`. */
function HBar<T extends { nama: string; jumlah: number }>({
  data,
  color,
  onPick,
  unit = 'anggota',
}: {
  data: T[];
  color: (d: T) => string;
  onPick?: (d: T) => void;
  unit?: string;
}) {
  const anim = !useReducedMotion();
  return (
    <div style={{ height: rowsHeight(data.length) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
          <XAxis type="number" allowDecimals={false} {...AXIS} />
          <YAxis
            type="category"
            dataKey="nama"
            width={112}
            {...AXIS}
            tick={{ ...AXIS.tick, fill: 'var(--foreground)' }}
          />
          <Tooltip
            cursor={{ fill: 'var(--accent)' }}
            content={tip<T>((d) => (
              <TooltipBox
                title={d.nama}
                rows={[
                  {
                    label: unit,
                    value: d.jumlah,
                    color: color(d),
                  },
                ]}
              />
            ))}
          />
          <Bar
            isAnimationActive={anim}
            dataKey="jumlah"
            barSize={BAR}
            radius={[0, 4, 4, 0]}
            className={onPick ? 'cursor-pointer' : undefined}
            onClick={
              onPick
                ? (_, i) => {
                    const d = data[i];
                    if (d) onPick(d);
                  }
                : undefined
            }
            shape={(p: { x: number; y: number; width: number; height: number; index: number }) => (
              <path
                d={barEnd(p.x, p.y, p.width, p.height)}
                fill={color(data[p.index] ?? data[0]!)}
              />
            )}
          >
            <LabelList
              dataKey="jumlah"
              position="right"
              fill="var(--muted-foreground)"
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KategoriChart({ data }: { data: Ringkasan['kategori'] }) {
  const router = useRouter();
  return (
    <ChartCard
      title="Sebaran kategori"
      description="Anggota aktif per kategori. Satu orang bisa masuk beberapa kategori. Klik batang untuk melihat daftarnya."
      table={{ head: ['Kategori', 'Anggota'], rows: data.map((k) => [k.nama, k.jumlah]) }}
    >
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada kategori.</p>
      ) : (
        <HBar
          data={data}
          color={(k) => KATEGORI_HEX[k.warna] ?? KATEGORI_HEX.slate}
          onPick={(k) => router.push(`/admin/anggota?kategoriId=${k.id}`)}
        />
      )}
    </ChartCard>
  );
}

/** Desa → kelompok: klik desa untuk merinci, klik kelompok untuk membuka daftar anggota. */
export function WilayahChart({ data }: { data: Ringkasan['wilayah'] }) {
  const router = useRouter();
  const [pilih, setPilih] = useState<string | null>(null);
  const tunggal = data.length === 1;
  const desa = data.find((d) => d.id === pilih) ?? (tunggal ? data[0] : undefined);
  const rows = desa ? desa.kelompok : data;
  return (
    <ChartCard
      title={desa ? `Kelompok di ${desa.nama}` : 'Anggota aktif per desa'}
      description={
        desa
          ? 'Klik batang kelompok untuk membuka daftar anggotanya.'
          : 'Klik batang desa untuk melihat kelompoknya.'
      }
      table={{
        head: [desa ? 'Kelompok' : 'Desa', 'Anggota'],
        rows: rows.map((r) => [r.nama, r.jumlah]),
      }}
      action={
        desa && (
          <Link
            href={`/admin/anggota?desaId=${desa.id}`}
            className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent"
          >
            Daftar anggota
          </Link>
        )
      }
    >
      {desa && !tunggal && (
        <button
          type="button"
          onClick={() => setPilih(null)}
          className="mb-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          ← Semua desa
        </button>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada data wilayah.</p>
      ) : (
        <HBar
          key={desa?.id ?? 'desa'}
          data={rows}
          color={() => 'var(--chart-1)'}
          onPick={(r) => (desa ? router.push(`/admin/anggota?kelompokId=${r.id}`) : setPilih(r.id))}
        />
      )}
    </ChartCard>
  );
}

type Bulan = Ringkasan['pertumbuhan'][number];

export function PertumbuhanChart({ data }: { data: Ringkasan['pertumbuhan'] }) {
  const total = data.reduce((s, b) => s + b.baru, 0);
  const anim = !useReducedMotion();
  return (
    <ChartCard
      title="Anggota baru per bulan"
      description={`${total.toLocaleString('id-ID')} anggota baru terdaftar dalam 12 bulan terakhir.`}
      table={{
        head: ['Bulan', 'Anggota baru'],
        rows: data.map((b) => [labelBulan(b.bulan), b.baru]),
      }}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id="isi-baru" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="bulan" tickFormatter={labelBulan} minTickGap={16} {...AXIS} />
            <YAxis allowDecimals={false} {...AXIS} axisLine={false} />
            <Tooltip
              cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }}
              content={tip<Bulan>((d) => (
                <TooltipBox
                  title={labelBulan(d.bulan)}
                  rows={[
                    {
                      label: 'Anggota baru',
                      value: d.baru,
                      color: 'var(--chart-1)',
                    },
                  ]}
                />
              ))}
            />
            <Area
              isAnimationActive={anim}
              type="monotone"
              dataKey="baru"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#isi-baru)"
              activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

const MUTASI = [
  { key: 'masuk', label: 'Masuk', color: 'var(--chart-1)' },
  { key: 'keluar', label: 'Keluar', color: 'var(--chart-2)' },
  { key: 'dalam', label: 'Pindah di dalam wilayah', color: 'var(--chart-3)' },
] as const;

export function MutasiChart({ data }: { data: Ringkasan['pertumbuhan'] }) {
  const ada = data.some((b) => b.masuk + b.keluar + b.dalam > 0);
  const anim = !useReducedMotion();
  return (
    <ChartCard
      title="Mutasi sambung"
      description="Perpindahan kelompok per bulan, dilihat dari wilayah Anda."
      table={{
        head: ['Bulan', ...MUTASI.map((m) => m.label)],
        rows: data.map((b) => [labelBulan(b.bulan), b.masuk, b.keluar, b.dalam]),
      }}
    >
      {!ada ? (
        <p className="text-sm text-muted-foreground">Belum ada mutasi dalam 12 bulan terakhir.</p>
      ) : (
        <>
          <Legend items={MUTASI.map((m) => ({ label: m.label, color: m.color }))} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="bulan" tickFormatter={labelBulan} minTickGap={16} {...AXIS} />
                <YAxis allowDecimals={false} {...AXIS} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'var(--accent)' }}
                  content={tip<Bulan>((d) => (
                    <TooltipBox
                      title={labelBulan(d.bulan)}
                      rows={MUTASI.map((m) => ({
                        label: m.label,
                        value: d[m.key],
                        color: m.color,
                      }))}
                    />
                  ))}
                />
                {MUTASI.map((m) => (
                  <Bar
                    isAnimationActive={anim}
                    key={m.key}
                    dataKey={m.key}
                    fill={m.color}
                    maxBarSize={10}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </ChartCard>
  );
}

export const GRUP: { key: GrupAksi; label: string; color: string }[] = [
  { key: 'tambah', label: 'Ditambahkan', color: 'var(--chart-1)' },
  { key: 'ubah', label: 'Diubah', color: 'var(--chart-2)' },
  { key: 'pindah', label: 'Pindah', color: 'var(--chart-3)' },
  { key: 'wali', label: 'Wali', color: 'var(--chart-4)' },
];

type Hari = AktivitasAudit['perHari'][number];

export function AktivitasChart({ data }: { data: AktivitasAudit['perHari'] }) {
  const anim = !useReducedMotion();
  return (
    <ChartCard
      title="Perubahan per hari"
      description="30 hari terakhir, menurut jenis perubahan."
      table={{
        head: ['Tanggal', ...GRUP.map((g) => g.label)],
        rows: data.map((h) => [labelHari(h.hari), ...GRUP.map((g) => h[g.key])]),
      }}
    >
      <Legend items={GRUP} />
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="hari" tickFormatter={labelHari} minTickGap={20} {...AXIS} />
            <YAxis allowDecimals={false} {...AXIS} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--accent)' }}
              content={tip<Hari>((d) => (
                <TooltipBox
                  title={labelHari(d.hari)}
                  rows={GRUP.map((g) => ({
                    label: g.label,
                    value: d[g.key],
                    color: g.color,
                  }))}
                />
              ))}
            />
            {GRUP.map((g, i) => (
              <Bar
                isAnimationActive={anim}
                key={g.key}
                dataKey={g.key}
                stackId="a"
                fill={g.color}
                stroke="var(--card)"
                strokeWidth={1}
                maxBarSize={24}
                radius={i === GRUP.length - 1 ? [4, 4, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function PelakuChart({ data }: { data: AktivitasAudit['pelaku'] }) {
  return (
    <ChartCard
      title="Siapa yang mengubah"
      description="Pengguna dengan perubahan terbanyak, 30 hari terakhir."
      table={{ head: ['Pengguna', 'Perubahan'], rows: data.map((p) => [p.nama, p.jumlah]) }}
    >
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada perubahan.</p>
      ) : (
        <HBar data={data} color={() => 'var(--chart-1)'} unit="perubahan" />
      )}
    </ChartCard>
  );
}

export function EntitasChart({ data }: { data: AktivitasAudit['entitas'] }) {
  return (
    <ChartCard
      title="Apa yang diubah"
      description="Jumlah perubahan per jenis data, 30 hari terakhir."
      table={{ head: ['Data', 'Perubahan'], rows: data.map((e) => [e.nama, e.jumlah]) }}
    >
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada perubahan.</p>
      ) : (
        <HBar data={data} color={() => 'var(--chart-1)'} unit="perubahan" />
      )}
    </ChartCard>
  );
}
