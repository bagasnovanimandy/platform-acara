import { describe, expect, it } from 'vitest';
import { laplacianVariance } from './blur.js';
import { createMatcher, euclidean } from './matcher.js';
import { cocokPose, estimatePose, type Point } from './pose.js';

/** 68 landmark sintetis: mata di y=100, hidung (30) dan dagu (8) diatur. */
function wajah({ hidungX = 100, hidungY = 140, daguY = 200 } = {}): Point[] {
  const pts: Point[] = Array.from({ length: 68 }, () => ({ x: 100, y: 150 }));
  for (let i = 36; i < 42; i++) pts[i] = { x: 70, y: 100 };
  for (let i = 42; i < 48; i++) pts[i] = { x: 130, y: 100 };
  pts[30] = { x: hidungX, y: hidungY };
  pts[8] = { x: 100, y: daguY };
  return pts;
}

describe('estimatePose', () => {
  it('lurus: yaw 0, pitch = (hidung - mata) / (dagu - mata)', () => {
    const p = estimatePose(wajah());
    expect(p.yaw).toBeCloseTo(0);
    expect(p.pitch).toBeCloseTo(0.4);
    expect(cocokPose('LURUS', p, 0.4)).toBe(true);
  });

  it('menoleh: hidung bergeser 0.3 × jarak mata', () => {
    const kananLayar = estimatePose(wajah({ hidungX: 118 }));
    expect(kananLayar.yaw).toBeCloseTo(0.3);
    // Kamera depan dicerminkan: hidung ke kanan layar = menoleh ke kiri pengguna.
    expect(cocokPose('KIRI', kananLayar, 0.4)).toBe(true);
    expect(cocokPose('KANAN', kananLayar, 0.4)).toBe(false);
    expect(cocokPose('KANAN', kananLayar, 0.4, false)).toBe(true);
    expect(cocokPose('LURUS', kananLayar, 0.4)).toBe(false);
  });

  it('menengadah dan menunduk relatif terhadap pitch lurus', () => {
    const atas = estimatePose(wajah({ hidungY: 130 }));
    const bawah = estimatePose(wajah({ hidungY: 150 }));
    expect(cocokPose('ATAS', atas, 0.4)).toBe(true);
    expect(cocokPose('BAWAH', bawah, 0.4)).toBe(true);
    expect(cocokPose('ATAS', bawah, 0.4)).toBe(false);
  });

  it('menolak landmark tidak lengkap', () => {
    expect(() => estimatePose([])).toThrow();
  });
});

describe('createMatcher', () => {
  const a = [0, 0, 0];
  const b = [1, 0, 0];
  const m = createMatcher(
    [
      { label: 'A', descriptors: [a] },
      { label: 'B', descriptors: [b, [0.9, 0.1, 0]] },
    ],
    0.5,
  );

  it('memilih jarak terdekat di bawah ambang', () => {
    expect(euclidean(a, b)).toBe(1);
    expect(m.match([0.1, 0, 0])?.label).toBe('A');
    expect(m.match([0.85, 0.1, 0])?.label).toBe('B');
  });

  it('null bila semua jarak ≥ ambang', () => {
    expect(m.match([0.5, 0.5, 0.5])).toBeNull();
    expect(m.nearest([0.5, 0.5, 0.5])).not.toBeNull();
  });
});

describe('laplacianVariance', () => {
  it('gambar polos = 0, gambar bertekstur > 0', () => {
    const w = 8;
    const polos = new Array(w * w).fill(128);
    const kotak = Array.from({ length: w * w }, (_, i) =>
      ((i % w) + Math.floor(i / w)) % 2 ? 255 : 0,
    );
    expect(laplacianVariance(polos, w, w)).toBe(0);
    expect(laplacianVariance(kotak, w, w)).toBeGreaterThan(1000);
  });
});
