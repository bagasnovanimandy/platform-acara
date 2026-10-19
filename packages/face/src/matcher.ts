/** Pencocokan descriptor wajah (jarak Euclid), setara FaceMatcher face-api. Murni. */

export interface MatcherEntry {
  /** Biasanya anggotaId. */
  label: string;
  descriptors: ArrayLike<number>[];
  /** Info tambahan, mis. faceDataId & status. */
  meta?: Record<string, string>;
}

export interface Match {
  label: string;
  distance: number;
  meta?: Record<string, string>;
}

export function euclidean(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) throw new Error('Panjang descriptor berbeda');
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    s += d * d;
  }
  return Math.sqrt(s);
}

export interface Matcher {
  readonly size: number;
  /** Label terdekat bila jaraknya < threshold, selain itu null. */
  match(descriptor: ArrayLike<number>): Match | null;
  /** Terdekat tanpa threshold (untuk diagnosa). */
  nearest(descriptor: ArrayLike<number>): Match | null;
}

export function createMatcher(entries: MatcherEntry[], threshold = 0.5): Matcher {
  const flat = entries.flatMap((e) => e.descriptors.map((d) => ({ e, d })));
  const nearest = (q: ArrayLike<number>): Match | null => {
    let best: Match | null = null;
    for (const { e, d } of flat) {
      const distance = euclidean(q, d);
      if (!best || distance < best.distance) best = { label: e.label, distance, meta: e.meta };
    }
    return best;
  };
  return {
    size: entries.length,
    nearest,
    match(q) {
      const n = nearest(q);
      return n && n.distance < threshold ? n : null;
    },
  };
}
