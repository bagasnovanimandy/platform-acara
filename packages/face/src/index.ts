// Wrapper @vladmandic/face-api (loadModels, detectOne, estimatePose, createMatcher, blurScore).
// Diisi pada fase 3 — lihat docs/HANDOVER.md §5.3–5.5.

/** Parameter default deteksi (AGENTS.md → Face recognition). */
export const FACE_DEFAULTS = {
  videoWidth: 640,
  videoHeight: 480,
  detectIntervalMs: 400,
  inputSize: 320,
  scoreThreshold: 0.5,
  matchThreshold: 0.5,
} as const;
