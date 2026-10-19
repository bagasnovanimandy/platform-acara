import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { CreateWaliDto, LinkAnakDto, ListWaliQuery, UpdateWaliDto } from './wali.dto.js';
import { WaliService } from './wali.service.js';

@Controller('wali')
@Roles('ADMIN', 'PENGURUS', 'AUDITOR')
export class WaliController {
  constructor(private readonly wali: WaliService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListWaliQuery) {
    return this.wali.list(user, q);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wali.get(user, id);
  }

  @Post()
  @Roles('ADMIN')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWaliDto) {
    return this.wali.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateWaliDto) {
    return this.wali.update(user, id, dto);
  }

  @Post(':id/anak')
  @Roles('ADMIN')
  linkAnak(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: LinkAnakDto) {
    return this.wali.linkAnak(user, id, dto);
  }
}
