/** Estimasi pose kepala dari 68 landmark (HANDOVER §5.5). Murni, tanpa face-api. */

export interface Point {
  x: number;
  y: number;
}

export interface Pose {
  /** Negatif = menoleh ke kiri layar, positif = ke kanan. */
  yaw: number;
  /** ±0.4–0.5 saat lurus; makin kecil = menengadah, makin besar = menunduk. */
  pitch: number;
}

export type PoseName = 'LURUS' | 'KIRI' | 'KANAN' | 'ATAS' | 'BAWAH';

/** Urutan pengambilan saat enrollment. */
export const POSE_URUTAN: readonly PoseName[] = ['LURUS', 'KIRI', 'KANAN', 'ATAS', 'BAWAH'];

export const POSE_AMBANG = { lurus: 0.08, menoleh: 0.22, angguk: 0.08 } as const;

function rata(points: Point[]): Point {
  const n = points.length;
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  };
}

export function estimatePose(landmarks: readonly Point[]): Pose {
  if (landmarks.length < 68) throw new Error('Butuh 68 landmark');
  const mataKiri = rata(landmarks.slice(36, 42));
  const mataKanan = rata(landmarks.slice(42, 48));
  const tengah = { x: (mataKiri.x + mataKanan.x) / 2, y: (mataKiri.y + mataKanan.y) / 2 };
  const jarakMata = Math.abs(mataKanan.x - mataKiri.x) || 1;
  const hidung = landmarks[30]!;
  const dagu = landmarks[8]!;
  const tinggi = dagu.y - tengah.y || 1;
  return {
    yaw: (hidung.x - tengah.x) / jarakMata,
    pitch: (hidung.y - tengah.y) / tinggi,
  };
}

/**
 * Apakah pose sesuai target. `pitchLurus` dikalibrasi saat pose LURUS.
 * `mirror` = gambar kamera depan dicerminkan (kiri pengguna = kiri layar).
 */
export function cocokPose(target: PoseName, p: Pose, pitchLurus: number, mirror = true): boolean {
  const yaw = mirror ? -p.yaw : p.yaw;
  switch (target) {
    case 'LURUS':
      return Math.abs(p.yaw) < POSE_AMBANG.lurus;
    case 'KIRI':
      return yaw < -POSE_AMBANG.menoleh;
    case 'KANAN':
      return yaw > POSE_AMBANG.menoleh;
    case 'ATAS':
      return p.pitch < pitchLurus - POSE_AMBANG.angguk;
    case 'BAWAH':
      return p.pitch > pitchLurus + POSE_AMBANG.angguk;
  }
}
