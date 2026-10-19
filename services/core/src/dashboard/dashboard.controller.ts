import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { DashboardService } from './dashboard.service.js';

/** Angka dashboard, selalu dibatasi wilayah user. */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('ringkasan')
  @Roles('ADMIN', 'PENGURUS', 'AUDITOR')
  ringkasan(@CurrentUser() user: AuthUser) {
    return this.dashboard.ringkasan(user);
  }

  @Get('audit')
  @Roles('ADMIN', 'AUDITOR')
  audit(@CurrentUser() user: AuthUser) {
    return this.dashboard.audit(user);
  }
}
