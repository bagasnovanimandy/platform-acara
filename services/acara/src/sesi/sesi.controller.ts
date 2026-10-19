import { Body, Controller, Delete, Param, Patch, Post, Put } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import {
  CreateRundownDto,
  CreateSesiDto,
  UpdateRundownDto,
  UpdateSesiDto,
  UrutanDto,
} from './sesi.dto.js';
import { SesiService } from './sesi.service.js';

@Controller()
@Roles('ADMIN')
export class SesiController {
  constructor(private readonly sesi: SesiService) {}

  @Post('acara/:id/sesi')
  create(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateSesiDto) {
    return this.sesi.create(user, id, dto);
  }

  @Patch('sesi/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSesiDto) {
    return this.sesi.update(user, id, dto);
  }

  @Delete('sesi/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sesi.remove(user, id);
  }

  @Post('sesi/:id/rundown')
  addRundown(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateRundownDto,
  ) {
    return this.sesi.addRundown(user, id, dto);
  }

  @Put('sesi/:id/rundown/urutan')
  reorder(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UrutanDto) {
    return this.sesi.reorder(user, id, dto);
  }

  @Patch('rundown/:id')
  updateRundown(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRundownDto,
  ) {
    return this.sesi.updateRundown(user, id, dto);
  }

  @Delete('rundown/:id')
  removeRundown(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sesi.removeRundown(user, id);
  }
}
