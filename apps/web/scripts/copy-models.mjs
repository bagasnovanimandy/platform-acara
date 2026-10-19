// Salin model face-api yang dipakai ke public/models (tidak di-commit).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '../../../packages/face/package.json'));
const src = join(dirname(require.resolve('@vladmandic/face-api/package.json')), 'model');
const dest = join(here, '../public/models');
const files = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model.bin',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_tiny_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin',
];
mkdirSync(dest, { recursive: true });
for (const f of files) {
  if (!existsSync(join(src, f))) throw new Error(`Model tidak ditemukan: ${f}`);
  copyFileSync(join(src, f), join(dest, f));
}
console.log(`Model face-api disalin ke ${dest}`);
