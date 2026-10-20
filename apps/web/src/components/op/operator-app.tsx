'use client';

import {
  createMatcher,
  detectOne,
  FACE_DEFAULTS,
  loadModels,
  type Matcher,
} from '@platform-acara/face';
import { Camera, CloudOff, RefreshCw, ScanFace, Search, UserPlus, Wifi } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { kameraTersimpan, simpanKamera } from '@/lib/op/session';
import type { OpSession, PesertaPaket } from '@/lib/op/types';
import { cn } from '@/lib/utils';
import { EnrollOverlay } from './enroll-overlay';
import { CariSheet, TamuSheet } from './sheets';
import { useOpData } from './use-op-data';

const KARTU_MS = 1_500;
const COOLDOWN_MS = 60_000;
const SARAN_CARI_MS = 3_000;
/** Tawaran "Daftarkan wajah" hilang sendiri bila tidak dijawab. */
const TAWAR_MS = 20_000;

/** UUID v4 (crypto.randomUUID butuh konteks aman). */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

type Kartu =
  | { jenis: 'hadir'; nama: string; kelompok: string; metode: string }
  | { jenis: 'sudah'; nama: string; kelompok: string }
  | { jenis: 'tamu'; nama: string }
  | { jenis: 'wajah'; nama: string };

export function OperatorApp({
  session,
  onExpired,
}: {
  session: OpSession;
  onExpired: (alasan?: string) => void;
}) {
  // Sheet terbuka = operator sedang mengetik (dilaporkan lewat heartbeat).
  const [sheet, setSheet] = useState<'cari' | 'tamu' | null>(null);
  const [enroll, setEnroll] = useState<PesertaPaket | null>(null);
  const [tawar, setTawar] = useState<PesertaPaket | null>(null);
  const data = useOpData(session, onExpired, sheet !== null || enroll !== null);
  const { paket, pesertaById, sudahHadir, catat, wajahLokal, daftarWajah } = data;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [kameraError, setKameraError] = useState<string | null>(null);
  const [model, setModel] = useState<'memuat' | 'siap' | 'gagal'>('memuat');
  const [wajahTerlihat, setWajahTerlihat] = useState(false);
  const [saranCari, setSaranCari] = useState(false);
  const [kartu, setKartu] = useState<Kartu | null>(null);

  const kartuUntil = useRef(0);
  const cooldown = useRef(new Map<string, number>());
  const tidakDikenalSejak = useRef<number | null>(null);

  // Wajah dari paket + wajah yang baru didaftarkan di perangkat ini (langsung dipakai).
  const matcher: Matcher | null = useMemo(() => {
    if (!paket) return null;
    const diPaket = new Set(paket.wajah.map((w) => w.id));
    return createMatcher(
      [
        ...paket.wajah.map((w) => ({
          label: w.anggotaId,
          descriptors: w.descriptors,
          meta: { faceDataId: w.id, status: w.status },
        })),
        ...wajahLokal
          .filter((w) => !w.serverId || !diPaket.has(w.serverId))
          .map((w) => ({
            label: w.anggotaId,
            descriptors: w.descriptors,
            meta: { faceDataId: w.serverId ?? w.clientId, status: 'PENDING' },
          })),
      ],
      paket.threshold || FACE_DEFAULTS.matchThreshold,
    );
  }, [paket, wajahLokal]);

  const punyaWajah = useMemo(
    () =>
      new Set([
        ...(paket?.wajah.map((w) => w.anggotaId) ?? []),
        ...wajahLokal.map((w) => w.anggotaId),
      ]),
    [paket, wajahLokal],
  );

  useEffect(() => {
    if (!tawar) return;
    const t = setTimeout(() => setTawar(null), TAWAR_MS);
    return () => clearTimeout(t);
  }, [tawar]);

  const tampilkan = useCallback((k: Kartu) => {
    setKartu(k);
    kartuUntil.current = Date.now() + KARTU_MS;
    setTimeout(() => {
      if (Date.now() >= kartuUntil.current) setKartu(null);
    }, KARTU_MS);
  }, []);

  /** Catat hadir untuk anggota (wajah atau manual). */
  const hadirkan = useCallback(
    async (
      p: PesertaPaket,
      metode: 'WAJAH' | 'MANUAL',
      face?: { faceDataId: string | null; distance: number },
    ) => {
      cooldown.current.set(p.id, Date.now());
      if (sudahHadir.has(p.id)) {
        tampilkan({ jenis: 'sudah', nama: p.nama, kelompok: p.kelompok });
        return;
      }
      const capturedAt = new Date().toISOString();
      await catat(
        metode === 'WAJAH'
          ? {
              clientId: uuid(),
              metode,
              anggotaId: p.id,
              faceDataId: face?.faceDataId ?? null,
              faceDistance: face?.distance ?? null,
              capturedAt,
            }
          : { clientId: uuid(), metode, anggotaId: p.id, capturedAt },
      );
      tampilkan({
        jenis: 'hadir',
        nama: p.nama,
        kelompok: p.kelompok,
        metode: metode === 'WAJAH' ? 'Wajah' : 'Manual',
      });
    },
    [catat, sudahHadir, tampilkan],
  );

  // Muat model wajah (dari cache service worker saat offline).
  useEffect(() => {
    loadModels('/models').then(
      () => setModel('siap'),
      () => setModel('gagal'),
    );
  }, []);

  // Kamera: pilih dari enumerateDevices, ingat di localStorage.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    void (async () => {
      try {
        const want = deviceId ?? kameraTersimpan();
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            width: FACE_DEFAULTS.videoWidth,
            height: FACE_DEFAULTS.videoHeight,
            ...(want ? { deviceId: { exact: want } } : { facingMode: 'user' }),
          },
        });
        if (!alive) return;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        const list = (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === 'videoinput',
        );
        setDevices(list);
        const aktif = stream.getVideoTracks()[0]?.getSettings().deviceId ?? null;
        if (!deviceId && aktif) setDeviceId(aktif);
        setKameraError(null);
      } catch (e) {
        if (deviceId === null && kameraTersimpan()) {
          // Kamera tersimpan tidak ada lagi: kembali ke default.
          simpanKamera('');
        }
        setKameraError(
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser.'
            : 'Kamera tidak bisa dibuka.',
        );
      }
    })();
    return () => {
      alive = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [deviceId]);

  // Loop deteksi tiap 400 ms.
  useEffect(() => {
    if (model !== 'siap' || !matcher) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const v = videoRef.current;
      if (!stop && v && v.readyState >= 2 && !sheet && !enroll) {
        try {
          const det = await detectOne(v);
          const now = Date.now();
          setWajahTerlihat(!!det);
          if (!det) {
            tidakDikenalSejak.current = null;
          } else if (now >= kartuUntil.current) {
            const m = matcher.match(det.descriptor);
            const p = m ? pesertaById.get(m.label) : undefined;
            if (m && p) {
              tidakDikenalSejak.current = null;
              setSaranCari(false);
              const last = cooldown.current.get(p.id) ?? 0;
              if (now - last >= COOLDOWN_MS) {
                await hadirkan(p, 'WAJAH', {
                  faceDataId: m.meta?.faceDataId ?? null,
                  distance: m.distance,
                });
              }
            } else {
              tidakDikenalSejak.current ??= now;
              if (now - tidakDikenalSejak.current >= SARAN_CARI_MS) setSaranCari(true);
            }
          }
        } catch {
          // frame gagal diproses: lanjut ke frame berikutnya
        }
      }
      if (!stop) timer = setTimeout(() => void tick(), FACE_DEFAULTS.detectIntervalMs);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [model, matcher, pesertaById, hadirkan, sheet, enroll]);

  const total = paket?.peserta.length ?? 0;
  const hadir = [...sudahHadir].filter((id) => pesertaById.has(id)).length;

  return (
    <div className="fixed inset-0 flex flex-col bg-neutral-950 text-white select-none">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        aria-label="Kamera"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />

      {enroll && (
        <EnrollOverlay
          peserta={enroll}
          videoRef={videoRef}
          onBatal={() => setEnroll(null)}
          onSelesai={(h) => {
            const p = enroll;
            setEnroll(null);
            void daftarWajah({
              clientId: uuid(),
              anggotaId: p.id,
              descriptors: h.descriptors,
              thumbnails: h.thumbnails,
              capturedAt: new Date().toISOString(),
            });
            // Wajah baru langsung dicoba: orang yang sama di depan kamera akan dikenali.
            cooldown.current.delete(p.id);
            tampilkan({ jenis: 'wajah', nama: p.nama });
          }}
        />
      )}
      {!enroll && (
        <>
          {/* Bilah atas */}
          <header className="relative z-10 flex flex-wrap items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold">
                {paket?.sesi.acara.nama ?? session.sesi.acara}
              </div>
              <div className="truncate text-sm text-white/70">
                {paket?.sesi.nama ?? session.sesi.nama} · {session.operator.label}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 text-sm">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium',
                  data.online
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300',
                )}
                data-testid="status-jaringan"
              >
                {data.online ? <Wifi className="size-4" /> : <CloudOff className="size-4" />}
                {data.online ? 'Online' : 'Offline'}
              </span>
              <span className="text-white/80" data-testid="antrean">
                {data.antrean > 0 ? `${data.antrean} menunggu kirim` : 'Semua terkirim'}
              </span>
            </div>
          </header>

          <div className="relative z-10 flex items-center gap-3 px-4 text-sm">
            <span
              className="rounded-full bg-white/10 px-3 py-1 tabular-nums"
              data-testid="jumlah-hadir"
            >
              Hadir {hadir}/{total}
            </span>
            {devices.length > 1 && (
              <label className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
                <Camera className="size-4" aria-hidden />
                <span className="sr-only">Kamera</span>
                <select
                  className="max-w-40 bg-transparent text-white outline-none"
                  value={deviceId ?? ''}
                  onChange={(e) => {
                    setDeviceId(e.target.value);
                    simpanKamera(e.target.value);
                  }}
                >
                  {devices.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId} className="text-black">
                      {d.label || `Kamera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {data.online && (
              <button
                type="button"
                onClick={() => void data.unduhPaket()}
                className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1"
              >
                <RefreshCw className="size-4" aria-hidden /> Perbarui data
              </button>
            )}
          </div>

          {/* Tengah: bingkai wajah + status */}
          <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 p-6">
            {kameraError ? (
              <p className="rounded-xl bg-red-500/20 px-4 py-3 text-center text-red-100">
                {kameraError}
              </p>
            ) : !paket ? (
              <p className="text-center text-white/80">
                {data.paketError ??
                  (data.online
                    ? 'Mengunduh data peserta…'
                    : 'Belum ada data peserta. Sambungkan internet sekali untuk mengunduh.')}
              </p>
            ) : (
              <>
                <div
                  aria-hidden
                  className={cn(
                    'aspect-[3/4] w-[min(70vw,18rem)] rounded-[40%] border-4 transition-colors',
                    wajahTerlihat ? 'border-white/80' : 'border-white/25',
                  )}
                />
                <p className="text-center text-white/80" aria-live="polite">
                  {model === 'memuat'
                    ? 'Menyiapkan pengenal wajah…'
                    : model === 'gagal'
                      ? 'Pengenal wajah gagal dimuat. Pakai Cari Nama.'
                      : paket.wajah.length === 0
                        ? 'Belum ada wajah terdaftar. Pakai Cari Nama.'
                        : wajahTerlihat
                          ? 'Tahan sebentar…'
                          : 'Hadapkan wajah ke kamera'}
                </p>
                {saranCari && (
                  <button
                    type="button"
                    onClick={() => {
                      setSaranCari(false);
                      setSheet('cari');
                    }}
                    className="rounded-full bg-amber-400 px-5 py-2 font-medium text-black"
                  >
                    Wajah belum dikenali. Cari nama?
                  </button>
                )}
              </>
            )}
          </main>

          {/* Kartu hasil */}
          {kartu && (
            <div
              role="status"
              className={cn(
                'absolute inset-x-4 top-1/3 z-20 rounded-2xl p-6 text-center shadow-2xl',
                kartu.jenis === 'hadir' && 'bg-emerald-500 text-white',
                kartu.jenis === 'sudah' && 'bg-sky-500 text-white',
                kartu.jenis === 'tamu' && 'bg-violet-500 text-white',
                kartu.jenis === 'wajah' && 'bg-emerald-600 text-white',
              )}
            >
              <div className="text-5xl" aria-hidden>
                {kartu.jenis === 'sudah' ? '✓✓' : '✓'}
              </div>
              <div className="mt-2 text-2xl font-semibold">{kartu.nama}</div>
              <div className="text-white/90">
                {kartu.jenis === 'hadir' && `${kartu.kelompok} · Hadir (${kartu.metode})`}
                {kartu.jenis === 'sudah' && `${kartu.kelompok} · Sudah tercatat`}
                {kartu.jenis === 'tamu' && 'Tamu tercatat'}
                {kartu.jenis === 'wajah' && 'Wajah tersimpan, menunggu verifikasi admin'}
              </div>
            </div>
          )}

          {/* Tombol besar */}
          <footer className="relative z-10 grid grid-cols-2 gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setSheet('cari')}
              disabled={!paket}
              className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-white text-lg font-semibold text-black disabled:opacity-50"
            >
              <Search className="size-6" aria-hidden /> Cari Nama
            </button>
            <button
              type="button"
              onClick={() => setSheet('tamu')}
              disabled={!paket}
              className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-white/15 text-lg font-semibold disabled:opacity-50"
            >
              <UserPlus className="size-6" aria-hidden /> Tamu
            </button>
          </footer>
        </>
      )}

      {tawar && !enroll && !sheet && (
        <div
          role="dialog"
          aria-label="Daftarkan wajah"
          className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl bg-neutral-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <ScanFace className="size-10 shrink-0 text-emerald-300" aria-hidden />
            <div className="min-w-0">
              <div className="text-lg font-semibold">Daftarkan wajah sekarang?</div>
              <div className="truncate text-white/70">
                {tawar.nama} belum punya data wajah. Hanya butuh beberapa detik.
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTawar(null)}
              className="h-16 rounded-2xl bg-white/15 text-lg font-semibold"
            >
              Lewati
            </button>
            <button
              type="button"
              onClick={() => {
                setEnroll(tawar);
                setTawar(null);
              }}
              className="h-16 rounded-2xl bg-emerald-500 text-lg font-semibold"
            >
              Daftarkan
            </button>
          </div>
        </div>
      )}

      {sheet === 'cari' && paket && (
        <CariSheet
          peserta={paket.peserta}
          sudahHadir={sudahHadir}
          onClose={() => setSheet(null)}
          onPilih={async (p) => {
            setSheet(null);
            await hadirkan(p, 'MANUAL');
            if (!punyaWajah.has(p.id) && model === 'siap') setTawar(p);
          }}
        />
      )}
      {sheet === 'tamu' && (
        <TamuSheet
          onClose={() => setSheet(null)}
          onSimpan={async (nama, keterangan) => {
            setSheet(null);
            await catat({
              clientId: uuid(),
              metode: 'TAMU',
              nama,
              keterangan,
              capturedAt: new Date().toISOString(),
            });
            tampilkan({ jenis: 'tamu', nama });
          }}
        />
      )}
    </div>
  );
}
