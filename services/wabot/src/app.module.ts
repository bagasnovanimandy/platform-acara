import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './auth/auth.module.js';
import { BotModule } from './bot/bot.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { EventsModule } from './events/events.module.js';
import { HealthModule } from './health/health.module.js';
import { IzinModule } from './izin/izin.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SyncModule } from './sync/sync.module.js';
import { WaModule } from './wa/wa.module.js';

@Module({
  imports: [
    PrismaModule,
    ClientsModule,
    AuthModule,
    EventsModule,
    HealthModule,
    WaModule,
    SyncModule,
    IzinModule,
    BotModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
