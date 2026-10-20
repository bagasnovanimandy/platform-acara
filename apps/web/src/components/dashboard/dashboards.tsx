'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AKSI_LABEL } from '@/components/riwayat-list';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { api, errorMessage } from '@/lib/api';
import type { AktivitasAudit, Ringkasan } from '@/lib/dashboard-types';
import { formatWaktu } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { AcaraStats } from './acara-stats';
import { StatTile } from './chart-card';
import {
  AktivitasChart,
  EntitasChart,
  KategoriChart,
  MutasiChart,
  PelakuChart,
  PertumbuhanChart,
  WilayahChart,
} from './charts';
import { Gauge } from './gauge';
import { KehadiranStats } from './kehadiran-stats';
import { Reveal, RevealItem } from './motion';

export function useRingkasan() {
  return useQuery({
    queryKey: ['dashboard', 'ringkasan'],
    queryFn: () => api<Ringkasan>('/dashboard/ringkasan'),
  });
}

export function useAktivitas(enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'audit'],
    queryFn: () => api<AktivitasAudit>('/dashboard/audit'),
    enabled,
  });
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Memuat() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

export function KelengkapanGauges({ r }: { r: Ringkasan }) {
  return (
    <Section
      title="Kelengkapan data"
      description={`Dihitung dari ${r.aktif.toLocaleString('id-ID')} anggota aktif.`}
    >
      <Card>
        <CardContent>
          <Reveal className="grid grid-cols-3 gap-2 sm:gap-6">
            <RevealItem>
              <Gauge
                value={r.kelengkapan.kategori}
                label="Kategori terisi"
                hint="Sudah punya minimal satu kategori."
              />
            </RevealItem>
            <RevealItem>
              <Gauge
                value={r.kelengkapan.kontak}
                label="Kontak terisi"
                hint="Punya No WA sendiri atau wali."
              />
            </RevealItem>
            <RevealItem>
              <Gauge value={r.kelengkapan.tanggalLahir} label="Tanggal lahir terisi" />
            </RevealItem>
          </Reveal>
        </CardContent>
      </Card>
    </Section>
  );
}

/** Dashboard admin, super admin, dan pengurus. */
export function AdminDashboard() {
  const q = useRingkasan();
  if (q.error) return <Alert variant="destructive">{errorMessage(q.error)}</Alert>;
  if (!q.data) return <Memuat />;
  const r = q.data;
  return (
    <div className="flex flex-col gap-8">
      <Reveal className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RevealItem>
          <StatTile
            label="Anggota aktif"
            value={r.aktif}
            hint={`dari ${r.total.toLocaleString('id-ID')} terdaftar`}
          />
        </RevealItem>
        <RevealItem>
          <StatTile
            label="Laki-laki / Perempuan"
            value={r.jenisKelamin.L}
            format={(n) => `${Math.round(n)} / ${r.jenisKelamin.P}`}
            hint="anggota aktif"
          />
        </RevealItem>
        <RevealItem>
          <StatTile
            label="Pindah / nonaktif"
            value={r.status.PINDAH + r.status.NONAKTIF}
            hint={`${r.status.PINDAH} pindah · ${r.status.NONAKTIF} nonaktif`}
          />
        </RevealItem>
        <RevealItem>
          <StatTile
            label="Belum ada kategori"
            value={r.tanpaKategori}
            hint={
              r.tanpaKategori > 0 ? (
                <Link href="/admin/anggota" className="underline underline-offset-2">
                  perlu dilengkapi
                </Link>
              ) : (
                'semua sudah lengkap'
              )
            }
          />
        </RevealItem>
      </Reveal>

      <KelengkapanGauges r={r} />

      <Section title="Komposisi" description="Klik batang untuk membuka daftar anggota.">
        <Reveal className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <RevealItem>
            <KategoriChart data={r.kategori} />
          </RevealItem>
          <RevealItem>
            <WilayahChart data={r.wilayah} />
          </RevealItem>
        </Reveal>
      </Section>

      <Section title="Pertumbuhan">
        <Reveal className="grid gap-4 lg:grid-cols-2">
          <RevealItem>
            <PertumbuhanChart data={r.pertumbuhan} />
          </RevealItem>
          <RevealItem>
            <MutasiChart data={r.pertumbuhan} />
          </RevealItem>
        </Reveal>
      </Section>

      <Section title="Acara" description="Acara yang diselenggarakan atau diikuti wilayah Anda.">
        <AcaraStats />
      </Section>

      <Section
        title="Kehadiran"
        description="Rekap sesi yang sudah ditutup dalam 12 bulan terakhir, sesuai wilayah Anda."
      >
        <KehadiranStats />
      </Section>
    </div>
  );
}

function TerbaruList({ items }: { items: AktivitasAudit['terbaru'] }) {
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>;
  return (
    <ul className="divide-y">
      {items.map((r) => {
        const aksi = AKSI_LABEL[r.aksi] ?? { label: r.aksi, tone: 'bg-slate-400' };
        const href =
          r.entitas === 'Anggota' && r.entitasId ? `/admin/anggota/${r.entitasId}` : null;
        const body = (
          <>
            <span aria-hidden className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', aksi.tone)} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm">
                <span className="font-medium">{aksi.label}</span>
                <span className="text-muted-foreground"> · {r.entitas}</span>
              </span>
              <span className="truncate text-sm">{r.ringkasan}</span>
              <span className="text-xs text-muted-foreground">
                {r.userNama} · {formatWaktu(r.createdAt)}
              </span>
            </span>
          </>
        );
        return (
          <li key={r.id}>
            {href ? (
              <Link href={href} className="-mx-2 flex gap-3 rounded-md px-2 py-2.5 hover:bg-accent">
                {body}
                <span aria-hidden className="self-center text-muted-foreground">
                  ›
                </span>
              </Link>
            ) : (
              <div className="flex gap-3 py-2.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Panel aktivitas perubahan (dipakai auditor, juga tab "Aktivitas" untuk admin). */
export function AktivitasPanel() {
  const q = useAktivitas();
  if (q.error) return <Alert variant="destructive">{errorMessage(q.error)}</Alert>;
  if (!q.data) return <Memuat />;
  const a = q.data;
  const hariIni = a.perHari.at(-1);
  const jumlahHariIni = hariIni ? hariIni.tambah + hariIni.ubah + hariIni.pindah + hariIni.wali : 0;
  const hariAktif = a.perHari.filter((h) => h.tambah + h.ubah + h.pindah + h.wali > 0).length;
  return (
    <div className="flex flex-col gap-8">
      <Reveal className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RevealItem>
          <StatTile label="Perubahan 30 hari" value={a.total} />
        </RevealItem>
        <RevealItem>
          <StatTile label="Hari ini" value={jumlahHariIni} hint="perubahan" />
        </RevealItem>
        <RevealItem>
          <StatTile label="Hari dengan perubahan" value={hariAktif} hint="dari 30 hari" />
        </RevealItem>
        <RevealItem>
          <StatTile label="Pengguna yang mengubah" value={a.pelaku.length} />
        </RevealItem>
      </Reveal>

      <Reveal>
        <RevealItem>
          <AktivitasChart data={a.perHari} />
        </RevealItem>
      </Reveal>

      <Reveal className="grid gap-4 lg:grid-cols-2">
        <RevealItem>
          <PelakuChart data={a.pelaku} />
        </RevealItem>
        <RevealItem>
          <EntitasChart data={a.entitas} />
        </RevealItem>
      </Reveal>

      <Section
        title="Perubahan terbaru"
        description="Klik untuk membuka detail dan riwayat anggota."
      >
        <Reveal>
          <RevealItem>
            <Card>
              <CardContent>
                <TerbaruList items={a.terbaru} />
                <Link
                  href="/admin/riwayat"
                  className="mt-3 inline-block text-sm font-medium underline underline-offset-2"
                >
                  Semua riwayat
                </Link>
              </CardContent>
            </Card>
          </RevealItem>
        </Reveal>
      </Section>
    </div>
  );
}

/** Dashboard auditor: aktivitas perubahan + kelengkapan data. */
export function AuditorDashboard() {
  const r = useRingkasan();
  return (
    <div className="flex flex-col gap-8">
      <AktivitasPanel />
      {r.data && <KelengkapanGauges r={r.data} />}
    </div>
  );
}
