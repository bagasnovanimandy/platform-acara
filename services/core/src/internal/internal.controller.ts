import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { anggotaEventInclude, toAnggotaUpserted } from '../anggota/anggota.events.js';
import { Public } from '../auth/decorators.js';
import { InternalKeyGuard } from '../auth/guards.js';
import { PrismaService } from '../prisma/prisma.service.js';

class InternalAnggotaQuery extends createZodDto(
  z.object({
    ids: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',').filter(Boolean) : undefined)),
    updatedSince: z.iso.datetime({ offset: true }).optional(),
  }),
) {}

class InternalSettingQuery extends createZodDto(z.object({ prefix: z.string().optional() })) {}

/** Endpoint antar-service (header x-internal-key). Payload anggota = format event anggota.upserted. */
@Controller('internal')
@Public()
@UseGuards(InternalKeyGuard)
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('anggota')
  async anggota(@Query() q: InternalAnggotaQuery) {
    const rows = await this.prisma.anggota.findMany({
      where: {
        ...(q.ids ? { id: { in: q.ids } } : {}),
        ...(q.updatedSince ? { updatedAt: { gte: new Date(q.updatedSince) } } : {}),
      },
      include: anggotaEventInclude,
      orderBy: { updatedAt: 'asc' },
    });
    return rows.map(toAnggotaUpserted);
  }

  @Get('setting')
  setting(@Query() q: InternalSettingQuery) {
    return this.prisma.setting.findMany({
      where: q.prefix ? { key: { startsWith: q.prefix } } : {},
    });
  }
}
