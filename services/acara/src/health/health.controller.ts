import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const SERVICE_NAME = 'acara';

export interface HealthStatus {
  status: 'ok';
  service: string;
  db: 'up';
}

@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        code: 'DB_DOWN',
        message: 'Database tidak dapat dihubungi',
        details: { service: SERVICE_NAME },
      });
    }
    return { status: 'ok', service: SERVICE_NAME, db: 'up' };
  }
}
