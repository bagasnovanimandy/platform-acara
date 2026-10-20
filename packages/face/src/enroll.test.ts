import { describe, expect, it } from 'vitest';
import { kecerahan } from './blur.js';
import {
  cekKualitas,
  type EnrollState,
  enrollAwal,
  enrollSelesai,
  type FrameWajah,
  nilaiFrame,
} from './enroll.js';
import type { Point } from './pose.js';

/** Landmark sintetis: mata di y=100 (x 70/130), dagu di y=200; hidung diatur. */
function lm(hidungX = 100, hidungY = 140): Point[] {
  const pts: Point[] = Array.from({ length: 68 }, () => ({ x: 100, y: 150 }));
  for (let i = 36; i < 42; i++) pts[i] = { x: 70, y: 100 };
  for (let i = 42; i < 48; i++) pts[i] = { x: 130, y: 100 };
  pts[30] = { x: hidungX, y: hidungY };
  pts[8] = { x: 100, y: 200 };
  return pts;
}

const POSE_LM: Record<string, Point[]> = {
  LURUS: lm(),
  KIRI: lm(118), // dicerminkan: hidung ke kanan layar = menoleh ke kiri pengguna
  KANAN: lm(82),
  ATAS: lm(100, 130),
  BAWAH: lm(100, 150),
};

function frame(t: number, landmarks: Point[], ubah: Partial<FrameWajah> = {}): FrameWajah {
  return { t, score: 0.95, lebarRelatif: 0.4, blur: 100, terang: 120, landmarks, ...ubah };
}

describe('cekKualitas', () => {
  it('memberi alasan sesuai urutan prioritas', () => {
    expect(cekKualitas(null)).toBe('TIDAK_ADA');
    expect(cekKualitas(frame(0, lm(), { lebarRelatif: 0.1 }))).toBe('DEKATKAN');
    expect(cekKualitas(frame(0, lm(), { terang: 20 }))).toBe('KURANG_TERANG');
    expect(cekKualitas(frame(0, lm(), { blur: 2 }))).toBe('BURAM');
    expect(cekKualitas(frame(0, lm(), { score: 0.6 }))).toBe('BURAM');
    expect(cekKualitas(frame(0, lm()))).toBe('OK');
  });
});

describe('nilaiFrame', () => {
  it('mengambil 5 pose berurutan, masing-masing setelah tertahan 300 ms', () => {
    let s: EnrollState = enrollAwal();
    let t = 0;
    const diambil: string[] = [];
    for (const pose of ['LURUS', 'KIRI', 'KANAN', 'ATAS', 'BAWAH']) {
      for (let i = 0; i < 4; i++) {
        const h = nilaiFrame(s, frame(t, POSE_LM[pose]!));
        s = h.state;
        t += 120;
        if (h.ambil) diambil.push(h.pose!);
      }
    }
    expect(diambil).toEqual(['LURUS', 'KIRI', 'KANAN', 'ATAS', 'BAWAH']);
    expect(enrollSelesai(s)).toBe(true);
    expect(s.pitchLurus).toBeCloseTo(0.4);
  });

  it('tidak mengambil sebelum 300 ms dan mengulang hitungan bila pose lepas', () => {
    let h = nilaiFrame(enrollAwal(), frame(0, POSE_LM.LURUS!));
    expect(h.ambil).toBe(false);
    expect(h.pesan).toBe('Tahan sebentar');
    h = nilaiFrame(h.state, frame(200, POSE_LM.KIRI!));
    expect(h.cocok).toBe(false);
    expect(h.state.cocokSejak).toBeNull();
    h = nilaiFrame(h.state, frame(400, POSE_LM.LURUS!));
    h = nilaiFrame(h.state, frame(600, POSE_LM.LURUS!));
    expect(h.ambil).toBe(false);
    h = nilaiFrame(h.state, frame(700, POSE_LM.LURUS!));
    expect(h.ambil).toBe(true);
    expect(h.state.langkah).toBe(1);
  });

  it('kualitas buruk menahan langkah dan memberi pesan', () => {
    const h = nilaiFrame(enrollAwal(), frame(0, POSE_LM.LURUS!, { lebarRelatif: 0.1 }));
    expect(h.pesan).toBe('Dekatkan wajah');
    expect(nilaiFrame(enrollAwal(), null).pesan).toBe('Arahkan wajah ke kamera');
    expect(nilaiFrame(enrollAwal(), frame(0, lm(), { terang: 10 })).pesan).toBe('Kurang terang');
  });

  it('menunjukkan petunjuk pose saat belum cocok', () => {
    const s = { langkah: 1, pitchLurus: 0.4, cocokSejak: null };
    expect(nilaiFrame(s, frame(0, POSE_LM.LURUS!)).pesan).toBe('Menoleh ke kiri');
  });
});

describe('kecerahan', () => {
  it('rata-rata nilai abu-abu', () => {
    expect(kecerahan([0, 100, 200])).toBe(100);
    expect(kecerahan([])).toBe(0);
  });
});
