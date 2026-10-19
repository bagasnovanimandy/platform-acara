import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { CreateKategoriDto, UpdateKategoriDto } from './kategori.dto.js';
import { KategoriService } from './kategori.service.js';

@Controller('kategori')
@Roles('ADMIN', 'PENGURUS', 'AUDITOR')
export class KategoriController {
  constructor(private readonly kategori: KategoriService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.kategori.list(user);
  }

  @Post()
  @Roles('ADMIN')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateKategoriDto) {
    return this.kategori.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateKategoriDto) {
    return this.kategori.update(user, id, dto);
  }
}
