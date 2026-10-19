/** Deteksi wajah lewat @vladmandic/face-api. Hanya untuk browser. */
import type * as FaceApi from '@vladmandic/face-api';
import { FACE_DEFAULTS } from './defaults.js';
import type { Point } from './pose.js';

let api: typeof FaceApi | null = null;
let loading: Promise<typeof FaceApi> | null = null;

// Tipe face-api tidak mengekspor setBackend/ready walau ada saat runtime.
interface TfRuntime {
  setBackend(name: string): Promise<boolean>;
  ready(): Promise<void>;
}

/** WebGL bila tersedia; selain itu CPU (lebih lambat, tapi tidak butuh file .wasm). */
async function pilihBackend(f: typeof FaceApi): Promise<void> {
  const tf = f.tf as unknown as TfRuntime;
  for (const b of ['webgl', 'cpu']) {
    try {
      if (await tf.setBackend(b)) break;
    } catch {
      // backend tidak tersedia di perangkat ini: coba berikutnya
    }
  }
  await tf.ready();
}

/**
 * Muat 3 model (tiny_face_detector, face_landmark_68_tiny, face_recognition) dari `baseUrl`,
 * mis. `/models`. Aman dipanggil berkali-kali.
 */
export function loadModels(baseUrl: string): Promise<typeof FaceApi> {
  loading ??= (async () => {
    const f = await import('@vladmandic/face-api');
    await pilihBackend(f);
    await Promise.all([
      f.nets.tinyFaceDetector.loadFromUri(baseUrl),
      f.nets.faceLandmark68TinyNet.loadFromUri(baseUrl),
      f.nets.faceRecognitionNet.loadFromUri(baseUrl),
    ]);
    api = f;
    return f;
  })().catch((e: unknown) => {
    loading = null;
    throw e;
  });
  return loading;
}

export function modelsReady(): boolean {
  return api !== null;
}

export interface Detection {
  box: { x: number; y: number; width: number; height: number };
  landmarks: Point[];
  descriptor: Float32Array;
  score: number;
}

/** Wajah terbesar di frame, atau null. Panggil `loadModels` dulu. */
export async function detectOne(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  opts: { inputSize?: number; scoreThreshold?: number } = {},
): Promise<Detection | null> {
  if (!api) throw new Error('Model belum dimuat');
  const r = await api
    .detectSingleFace(
      input,
      new api.TinyFaceDetectorOptions({
        inputSize: opts.inputSize ?? FACE_DEFAULTS.inputSize,
        scoreThreshold: opts.scoreThreshold ?? FACE_DEFAULTS.scoreThreshold,
      }),
    )
    .withFaceLandmarks(true)
    .withFaceDescriptor();
  if (!r) return null;
  const b = r.detection.box;
  return {
    box: { x: b.x, y: b.y, width: b.width, height: b.height },
    landmarks: r.landmarks.positions.map((p) => ({ x: p.x, y: p.y })),
    descriptor: r.descriptor,
    score: r.detection.score,
  };
}
