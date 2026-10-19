import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

function controllerWith(queryRaw: () => Promise<unknown>): HealthController {
  return new HealthController({ $queryRaw: vi.fn(queryRaw) } as unknown as PrismaService);
}

describe('HealthController (core)', () => {
  it('mengembalikan ok bila database terhubung', async () => {
    await expect(controllerWith(async () => [{ '?column?': 1 }]).check()).resolves.toEqual({
      status: 'ok',
      service: 'core',
      db: 'up',
    });
  });

  it('melempar 503 bila database mati', async () => {
    await expect(
      controllerWith(async () => {
        throw new Error('ECONNREFUSED');
      }).check(),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
