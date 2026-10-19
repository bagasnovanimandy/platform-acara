'use client';

import {
  detectOne,
  detectPose,
  type EnrollState,
  enrollAwal,
  enrollSelesai,
  nilaiFrame,
  POSE_URUTAN,
  thumbnailWajah,
  ukurWajah,
} from '@platform-acara/face';
import { Check, X } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import type { PesertaPaket } from '@/lib/op/types';
import { cn } from '@/lib/utils';

const LABEL_POSE = { LURUS: 'Lurus', KIRI: 'Kiri', KANAN: 'Kanan', ATAS: 'Atas', BAWAH: 'Bawah' };
/** Jeda antar-frame saat mendaftar (lebih rapat dari loop absen 400 ms). */
const JEDA_MS = 60;

export interface HasilDaftar {
  descriptors: number[][];
  thumbnails: string[];
}

/**
 * Pendaftaran wajah terpandu (HANDOVER §5.5) di atas video kamera yang sama:
 * 5 pose diambil otomatis bila kualitas cukup dan pose tertahan.
 */
export function EnrollOverlay({
  peserta,
  videoRef,
  onSelesai,
  onBatal,
}: {
  peserta: PesertaPaket;
  videoRef: RefObject<HTMLVideoElement | null>;
  onSelesai: (h: HasilDaftar) => void;
  onBatal: () => void;
}) {
  const [langkah, setLangkah] = useState(0);
  const [pesan, setPesan] = useState('Arahkan wajah ke kamera');
  const [cocok, setCocok] = useState(false);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const selesai = useRef(onSelesai);
  selesai.current = onSelesai;

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    let state: EnrollState = enrollAwal();
    const descriptors: number[][] = [];
    const thumbnails: string[] = [];
    // Frame dibekukan ke canvas: pose, embedding, dan thumbnail berasal dari gambar yang sama.
    const frame = document.createElement('canvas');

    const tick = async () => {
      const v = videoRef.current;
      if (stop) return;
      const ctx = frame.getContext('2d', { willReadFrequently: true });
      if (v && ctx && v.readyState >= 2 && v.videoWidth > 0) {
        try {
          frame.width = v.videoWidth;
          frame.height = v.videoHeight;
          ctx.drawImage(v, 0, 0);
          const det = await detectPose(frame);
          if (stop) return;
          const ukur = det ? ukurWajah(frame, det.box) : null;
          const h = nilaiFrame(
            state,
            det && ukur
              ? {
                  t: performance.now(),
                  score: det.score,
                  lebarRelatif: det.box.width / frame.width,
                  blur: ukur.blur,
                  terang: ukur.terang,
                  landmarks: det.landmarks,
                }
              : null,
          );
          setPesan(h.pesan);
          setCocok(h.cocok);
          // Embedding (berat) hanya untuk frame yang diambil.
          const full = h.ambil ? await detectOne(frame) : null;
          if (stop) return;
          if (!h.ambil || full) state = h.state;
          if (full) {
            descriptors.push(Array.from(full.descriptor));
            thumbnails.push(
              thumbnailWajah(frame, full.box, frame.width, frame.height, { cermin: false }),
            );
            setThumbs([...thumbnails]);
            setLangkah(state.langkah);
            if (enrollSelesai(state)) {
              selesai.current({ descriptors, thumbnails });
              return;
            }
          }
        } catch {
          // frame gagal diproses: lanjut
        }
      }
      timer = setTimeout(() => void tick(), JEDA_MS);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [videoRef]);

  const pose = POSE_URUTAN[langkah];
  return (
    <div className="absolute inset-0 z-30 flex flex-col" data-testid="enroll">
      <header className="flex items-start gap-3 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-white/70">Daftarkan wajah</div>
          <div className="truncate text-xl font-semibold">{peserta.nama}</div>
          <div className="truncate text-sm text-white/70">
            {peserta.kode} · {peserta.kelompok}
          </div>
        </div>
        <button
          type="button"
          onClick={onBatal}
          className="inline-flex h-12 items-center gap-1 rounded-2xl bg-white/15 px-4 font-medium"
        >
          <X className="size-5" aria-hidden /> Batal
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
        <div
          aria-hidden
          className={cn(
            'aspect-[3/4] w-[min(70vw,18rem)] rounded-[40%] border-[6px] transition-colors',
            cocok ? 'border-emerald-400' : 'border-white/40',
          )}
        />
        <p
          className="rounded-2xl bg-black/60 px-5 py-3 text-center text-2xl font-semibold"
          aria-live="polite"
          data-testid="enroll-pesan"
        >
          {pose ? pesan : 'Selesai'}
        </p>
      </div>

      <footer className="bg-gradient-to-t from-black/85 to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <ol className="grid grid-cols-5 gap-2" aria-label="Langkah pose">
          {POSE_URUTAN.map((p, i) => (
            <li
              key={p}
              className={cn(
                'flex flex-col items-center gap-1 text-sm',
                i === langkah ? 'text-white' : 'text-white/60',
              )}
            >
              <div
                className={cn(
                  'relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border-2',
                  i < langkah
                    ? 'border-emerald-400'
                    : i === langkah
                      ? 'border-white'
                      : 'border-white/20',
                )}
              >
                {thumbs[i] ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbs[i]} alt="" className="h-full w-full object-cover" />
                    <Check
                      className="absolute right-1 bottom-1 size-5 rounded-full bg-emerald-500 p-0.5"
                      aria-hidden
                    />
                  </>
                ) : (
                  <span className="text-lg font-semibold">{i + 1}</span>
                )}
              </div>
              {LABEL_POSE[p]}
            </li>
          ))}
        </ol>
      </footer>
    </div>
  );
}
