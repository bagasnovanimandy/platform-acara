import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AcaraModule } from './acara/acara.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { CoreModule } from './core/core.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { FotoModule } from './foto/foto.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SesiModule } from './sesi/sesi.module.js';
import { SyncModule } from './sync/sync.module.js';

@Module({
  imports: [
    PrismaModule,
    CoreModule,
    AuthModule,
    HealthModule,
    SyncModule,
    AcaraModule,
    SesiModule,
    FotoModule,
    DashboardModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
