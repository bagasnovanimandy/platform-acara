import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AnggotaModule } from './anggota/anggota.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { EventsModule } from './events/events.module.js';
import { HealthModule } from './health/health.module.js';
import { InternalModule } from './internal/internal.module.js';
import { KategoriModule } from './kategori/kategori.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ScopeModule } from './scope/scope.module.js';
import { UsersModule } from './users/users.module.js';
import { WaliModule } from './wali/wali.module.js';
import { WilayahModule } from './wilayah/wilayah.module.js';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    ScopeModule,
    AuditModule,
    AuthModule,
    HealthModule,
    WilayahModule,
    AnggotaModule,
    WaliModule,
    KategoriModule,
    UsersModule,
    InternalModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
