import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { calculateJwkThumbprint, exportJWK, type JWK } from 'jose';

export interface SigningKeys {
  privateKey: KeyObject;
  publicKey: KeyObject;
  kid: string;
  jwk: JWK;
}

export async function signingKeysFromPem(pem: string): Promise<SigningKeys> {
  const privateKey = createPrivateKey(pem);
  const publicKey = createPublicKey(privateKey);
  const base = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint(base);
  return { privateKey, publicKey, kid, jwk: { ...base, kid, alg: 'RS256', use: 'sig' } };
}

export function generatePrivateKeyPem(): string {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

/**
 * Ambil kunci dari env `JWT_PRIVATE_KEY` (PEM) atau file. Di luar produksi, file dibuat otomatis
 * bila belum ada supaya dev tidak perlu langkah manual.
 */
export async function loadSigningKeys(opts: {
  pem?: string;
  file: string;
  allowGenerate: boolean;
}): Promise<SigningKeys> {
  if (opts.pem) return signingKeysFromPem(opts.pem.replace(/\\n/g, '\n'));
  if (!existsSync(opts.file)) {
    if (!opts.allowGenerate) {
      throw new Error(`Kunci JWT tidak ditemukan: atur JWT_PRIVATE_KEY atau ${opts.file}`);
    }
    mkdirSync(dirname(opts.file), { recursive: true });
    writeFileSync(opts.file, generatePrivateKeyPem(), { mode: 0o600 });
  }
  return signingKeysFromPem(readFileSync(opts.file, 'utf8'));
}
