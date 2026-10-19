import { Injectable } from '@nestjs/common';
import { EVENTS } from '@platform-acara/shared';
import { EventsService } from '../events/events.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { anggotaEventInclude, toAnggotaUpserted } from './anggota.events.js';

/** Publish anggota.upserted untuk anggota yang cocok dengan filter (dipakai setelah perubahan). */
@Injectable()
export class AnggotaPublisher {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async publishWhere(where: Prisma.AnggotaWhereInput): Promise<void> {
    const rows = await this.prisma.anggota.findMany({ where, include: anggotaEventInclude });
    await this.events.publishMany(EVENTS.ANGGOTA_UPSERTED, rows.map(toAnggotaUpserted));
  }

  publishIds(ids: string[]): Promise<void> {
    return ids.length ? this.publishWhere({ id: { in: ids } }) : Promise.resolve();
  }
}
