/** Potong wajah dari video/canvas. Hanya untuk browser. */
import { kecerahan, laplacianVariance, toGray } from './blur.js';

export interface Kotak {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Kotak persegi di sekitar wajah (diperbesar `skala` ×), dibatasi tepi frame. */
export function kotakPersegi(box: Kotak, frameW: number, frameH: number, skala = 1.4): Kotak {
  const sisi = Math.min(Math.max(box.width, box.height) * skala, frameW, frameH);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const x = Math.min(Math.max(cx - sisi / 2, 0), frameW - sisi);
  const y = Math.min(Math.max(cy - sisi / 2, 0), frameH - sisi);
  return { x, y, width: sisi, height: sisi };
}

function gambar(source: CanvasImageSource, k: Kotak, sisi: number, cermin: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = sisi;
  canvas.height = sisi;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  if (cermin) {
    ctx.translate(sisi, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, k.x, k.y, k.width, k.height, 0, 0, sisi, sisi);
  return { canvas, ctx };
}

/** Ketajaman & kecerahan area wajah (diperkecil ke 96 px agar cepat). */
export function ukurWajah(source: CanvasImageSource, box: Kotak): { blur: number; terang: number } {
  const g = gambar(source, box, 96, false);
  if (!g) return { blur: 0, terang: 0 };
  const { data } = g.ctx.getImageData(0, 0, 96, 96);
  const gray = toGray(data, 96, 96);
  return { blur: laplacianVariance(gray, 96, 96), terang: kecerahan(gray) };
}

/** Thumbnail wajah persegi (default 160 px) sebagai data URL WebP (PNG bila WebP tidak didukung). */
export function thumbnailWajah(
  source: CanvasImageSource,
  box: Kotak,
  frameW: number,
  frameH: number,
  { sisi = 160, cermin = true }: { sisi?: number; cermin?: boolean } = {},
): string {
  const g = gambar(source, kotakPersegi(box, frameW, frameH), sisi, cermin);
  return g ? g.canvas.toDataURL('image/webp', 0.8) : '';
}
