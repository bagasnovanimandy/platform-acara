import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { hashPassword, isLegacyHash, verifyPassword } from './password.js';

describe('password', () => {
  it('memverifikasi hash argon2', async () => {
    const h = await hashPassword('rahasia123');
    expect(isLegacyHash(h)).toBe(false);
    expect(await verifyPassword(h, 'rahasia123')).toBe(true);
    expect(await verifyPassword(h, 'salah')).toBe(false);
  });

  it('memverifikasi hash bcrypt hasil impor SiKU', async () => {
    const h = await bcrypt.hash('rahasia123', 4);
    expect(isLegacyHash(h)).toBe(true);
    expect(await verifyPassword(h, 'rahasia123')).toBe(true);
    expect(await verifyPassword(h, 'salah')).toBe(false);
  });
});
