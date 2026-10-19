import { Controller, Get, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { ListAuditQuery } from './audit.dto.js';
import { AuditService } from './audit.service.js';

@Controller('audit')
@Roles('ADMIN', 'AUDITOR')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListAuditQuery) {
    return this.audit.list(user, q);
  }
}
