import argon2 from 'argon2';

export const hashPassword = (password: string): Promise<string> =>
  argon2.hash(password, { type: argon2.argon2id });

export const verifyPassword = (hash: string, password: string): Promise<boolean> =>
  argon2.verify(hash, password).catch(() => false);

/** Hash palsu untuk menyamakan waktu respons saat email tidak terdaftar. */
let dummyHash: Promise<string> | undefined;
export const dummyVerify = async (password: string): Promise<void> => {
  dummyHash ??= hashPassword('dummy-password-untuk-timing');
  await verifyPassword(await dummyHash, password);
};
