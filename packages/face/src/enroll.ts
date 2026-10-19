/**
 * Alur daftar wajah terpandu (HANDOVER §5.4): Lurus → Kiri → Kanan → Atas → Bawah.
 * Murni (tanpa DOM/face-api) agar bisa diuji; komponen memberi hasil deteksi tiap frame.
 */
import { cocokPose, estimatePose, type Point, POSE_URUTAN, type PoseName } from './pose.js';

export const ENROLL_AMBANG = {
  /** Skor deteksi minimal. */
  score: 0.8,
  /** Lebar kotak wajah minimal, relatif terhadap lebar frame. */
  lebarMin: 0.25,
  /** Variansi Laplacian minimal (lihat `blurScore`). */
  blurMin: 15,
  /** Rata-rata kecerahan wajah minimal (0–255). */
  terangMin: 60,
  /** Pose harus tertahan selama ini sebelum diambil. */
  tahanMs: 300,
} as const;

export type Kualitas = 'OK' | 'TIDAK_ADA' | 'DEKATKAN' | 'KURANG_TERANG' | 'BURAM';

export const PESAN_KUALITAS: Record<Exclude<Kualitas, 'OK'>, string> = {
  TIDAK_ADA: 'Arahkan wajah ke kamera',
  DEKATKAN: 'Dekatkan wajah',
  KURANG_TERANG: 'Kurang terang',
  BURAM: 'Tahan sebentar',
};

export const PETUNJUK_POSE: Record<PoseName, string> = {
  LURUS: 'Lihat lurus ke kamera',
  KIRI: 'Menoleh ke kiri',
  KANAN: 'Menoleh ke kanan',
  ATAS: 'Angkat dagu sedikit',
  BAWAH: 'Tundukkan kepala sedikit',
};

export interface FrameWajah {
  /** Waktu frame (ms). */
  t: number;
  score: number;
  /** Lebar kotak wajah / lebar frame. */
  lebarRelatif: number;
  blur: number;
  terang: number;
  landmarks: readonly Point[];
}

export interface EnrollState {
  /** Indeks pose berikutnya di POSE_URUTAN; = 5 bila selesai. */
  langkah: number;
  /** Pitch saat LURUS, acuan pose ATAS/BAWAH. */
  pitchLurus: number | null;
  /** Sejak kapan pose target cocok tanpa putus. */
  cocokSejak: number | null;
}

export interface HasilFrame {
  state: EnrollState;
  kualitas: Kualitas;
  /** Pose target sedang cocok. */
  cocok: boolean;
  /** Frame ini diambil untuk pose `pose`; simpan descriptor & thumbnail-nya. */
  ambil: boolean;
  pose: PoseName | null;
  /** Pesan untuk operator/anggota. */
  pesan: string;
}

export function enrollAwal(): EnrollState {
  return { langkah: 0, pitchLurus: null, cocokSejak: null };
}

export function enrollSelesai(s: EnrollState): boolean {
  return s.langkah >= POSE_URUTAN.length;
}

export function cekKualitas(f: FrameWajah | null): Kualitas {
  if (!f) return 'TIDAK_ADA';
  if (f.lebarRelatif < ENROLL_AMBANG.lebarMin) return 'DEKATKAN';
  if (f.terang < ENROLL_AMBANG.terangMin) return 'KURANG_TERANG';
  if (f.score < ENROLL_AMBANG.score || f.blur < ENROLL_AMBANG.blurMin) return 'BURAM';
  return 'OK';
}

/** Nilai satu frame. Pose diambil otomatis bila kualitas OK dan pose cocok ≥ `tahanMs`. */
export function nilaiFrame(s: EnrollState, f: FrameWajah | null, mirror = true): HasilFrame {
  const pose = POSE_URUTAN[s.langkah] ?? null;
  if (!pose)
    return { state: s, kualitas: 'OK', cocok: false, ambil: false, pose, pesan: 'Selesai' };
  const kualitas = cekKualitas(f);
  if (kualitas !== 'OK' || !f) {
    return {
      state: { ...s, cocokSejak: null },
      kualitas,
      cocok: false,
      ambil: false,
      pose,
      pesan: PESAN_KUALITAS[kualitas === 'OK' ? 'TIDAK_ADA' : kualitas],
    };
  }
  const p = estimatePose(f.landmarks);
  const cocok = cocokPose(pose, p, s.pitchLurus ?? p.pitch, mirror);
  if (!cocok) {
    return {
      state: { ...s, cocokSejak: null },
      kualitas,
      cocok,
      ambil: false,
      pose,
      pesan: PETUNJUK_POSE[pose],
    };
  }
  const sejak = s.cocokSejak ?? f.t;
  if (f.t - sejak < ENROLL_AMBANG.tahanMs) {
    return {
      state: { ...s, cocokSejak: sejak },
      kualitas,
      cocok,
      ambil: false,
      pose,
      pesan: PESAN_KUALITAS.BURAM,
    };
  }
  return {
    state: {
      langkah: s.langkah + 1,
      pitchLurus: pose === 'LURUS' ? p.pitch : s.pitchLurus,
      cocokSejak: null,
    },
    kualitas,
    cocok,
    ambil: true,
    pose,
    pesan: 'Bagus',
  };
}
