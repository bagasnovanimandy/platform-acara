/** Parameter default deteksi (AGENTS.md → Face recognition). */
export const FACE_DEFAULTS = {
  videoWidth: 640,
  videoHeight: 480,
  detectIntervalMs: 400,
  inputSize: 320,
  scoreThreshold: 0.5,
  matchThreshold: 0.5,
} as const;

/** File model yang dipakai (di-host di apps/web/public/models). */
export const MODEL_FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model.bin',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_tiny_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin',
] as const;
