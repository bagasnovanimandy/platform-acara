import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { DecideIzinDto, ListIzinQuery } from './izin.dto.js';
import { IzinService } from './izin.service.js';

@Controller('izin')
export class IzinController {
  constructor(private readonly izin: IzinService) {}

  @Get()
  @Roles('ADMIN', 'PENGURUS', 'AUDITOR')
  list(@CurrentUser() user: AuthUser, @Query() q: ListIzinQuery) {
    return this.izin.list(user, q);
  }

  @Get('jumlah')
  @Roles('ADMIN', 'PENGURUS', 'AUDITOR')
  jumlah(@CurrentUser() user: AuthUser) {
    return this.izin.jumlahMenunggu(user);
  }

  @Post(':id/decide')
  @HttpCode(200)
  @Roles('ADMIN', 'PENGURUS')
  decide(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DecideIzinDto) {
    return this.izin.putuskanWeb(user, id, dto.status, dto.catatan);
  }
}
