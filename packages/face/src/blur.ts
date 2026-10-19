/** Ukuran ketajaman: variansi Laplacian pada citra abu-abu. Kecil = buram. */

export function laplacianVariance(gray: ArrayLike<number>, width: number, height: number): number {
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = gray[i - width]! + gray[i + width]! + gray[i - 1]! + gray[i + 1]! - 4 * gray[i]!;
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** RGBA (ImageData.data) → abu-abu (luma). */
export function toGray(rgba: ArrayLike<number>, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i++) {
    out[i] = 0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!;
  }
  return out;
}

/** Skor blur dari canvas (diperkecil dulu agar cepat). */
export function blurScore(source: CanvasImageSource, width: number, height: number): number {
  const w = Math.min(160, width);
  const h = Math.round((height / width) * w);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 0;
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return laplacianVariance(toGray(data, w, h), w, h);
}
