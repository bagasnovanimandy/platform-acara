import argon2 from 'argon2';
import bcrypt from 'bcryptjs';

export const hashPassword = (password: string): Promise<string> =>
  argon2.hash(password, { type: argon2.argon2id });

/** Hash bcrypt berasal dari impor pengguna SiKU; diganti argon2 saat login pertama. */
export const isLegacyHash = (hash: string): boolean => /^\$2[aby]\$/.test(hash);

export const verifyPassword = (hash: string, password: string): Promise<boolean> =>
  isLegacyHash(hash)
    ? bcrypt.compare(password, hash).catch(() => false)
    : argon2.verify(hash, password).catch(() => false);

/** Hash palsu untuk menyamakan waktu respons saat email tidak terdaftar. */
let dummyHash: Promise<string> | undefined;
export const dummyVerify = async (password: string): Promise<void> => {
  dummyHash ??= hashPassword('dummy-password-untuk-timing');
  await verifyPassword(await dummyHash, password);
};
