import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { DashboardService } from './dashboard.service.js';

/** Statistik acara untuk dashboard, dibatasi wilayah user. */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('acara')
  @Roles('ADMIN', 'PENGURUS', 'AUDITOR')
  acara(@CurrentUser() user: AuthUser) {
    return this.dashboard.acara(user);
  }

  @Get('kehadiran')
  @Roles('ADMIN', 'PENGURUS', 'AUDITOR')
  kehadiran(@CurrentUser() user: AuthUser) {
    return this.dashboard.kehadiran(user);
  }
}
