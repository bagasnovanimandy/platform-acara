import { describe, expect, it } from 'vitest';
import { generatePrivateKeyPem, signingKeysFromPem } from './keys.js';
import { TokenService } from './token.service.js';

process.env.DATABASE_URL ??= 'postgresql://x';

async function service(): Promise<TokenService> {
  const svc = new TokenService();
  svc.useKeys(await signingKeysFromPem(generatePrivateKeyPem()));
  return svc;
}

const user = { id: 'u1', role: 'ADMIN' as const, nama: 'Admin', email: 'a@x.id' };

describe('TokenService', () => {
  it('menerbitkan access & refresh token RS256 yang bisa diverifikasi', async () => {
    const svc = await service();
    const t = await svc.issue(user);
    expect(t.expiresIn).toBe(15 * 60);
    await expect(svc.verify(t.accessToken, 'access')).resolves.toEqual(user);
    await expect(svc.verify(t.refreshToken, 'refresh')).resolves.toEqual(user);
  });

  it('menolak refresh token dipakai sebagai access token', async () => {
    const svc = await service();
    const t = await svc.issue(user);
    await expect(svc.verify(t.refreshToken, 'access')).rejects.toThrow();
  });

  it('menolak token dari kunci lain', async () => {
    const a = await service();
    const b = await service();
    const t = await a.issue(user);
    await expect(b.verify(t.accessToken, 'access')).rejects.toThrow();
  });

  it('JWKS berisi kunci publik RS256 dengan kid', async () => {
    const svc = await service();
    const [key] = svc.jwks.keys;
    expect(key).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig' });
    expect(key?.kid).toBeTruthy();
    expect(key).not.toHaveProperty('d');
  });
});
