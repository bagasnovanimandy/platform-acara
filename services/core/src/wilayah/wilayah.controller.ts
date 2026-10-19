import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import {
  CreateDaerahDto,
  CreateDesaDto,
  CreateKelompokDto,
  ListDesaQuery,
  ListKelompokQuery,
  UpdateDaerahDto,
  UpdateDesaDto,
  UpdateKelompokDto,
} from './wilayah.dto.js';
import { WilayahService } from './wilayah.service.js';

@Controller('wilayah')
@Roles('ADMIN', 'PENGURUS')
export class WilayahController {
  constructor(private readonly wilayah: WilayahService) {}

  @Get('tree')
  tree(@CurrentUser() user: AuthUser) {
    return this.wilayah.tree(user);
  }

  @Get('daerah')
  listDaerah(@CurrentUser() user: AuthUser) {
    return this.wilayah.listDaerah(user);
  }

  @Post('daerah')
  @Roles('SUPER_ADMIN')
  createDaerah(@Body() dto: CreateDaerahDto) {
    return this.wilayah.createDaerah(dto);
  }

  @Patch('daerah/:id')
  @Roles('ADMIN')
  updateDaerah(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDaerahDto,
  ) {
    return this.wilayah.updateDaerah(user, id, dto);
  }

  @Get('desa')
  listDesa(@CurrentUser() user: AuthUser, @Query() q: ListDesaQuery) {
    return this.wilayah.listDesa(user, q.daerahId);
  }

  @Post('desa')
  @Roles('ADMIN')
  createDesa(@CurrentUser() user: AuthUser, @Body() dto: CreateDesaDto) {
    return this.wilayah.createDesa(user, dto);
  }

  @Patch('desa/:id')
  @Roles('ADMIN')
  updateDesa(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateDesaDto) {
    return this.wilayah.updateDesa(user, id, dto);
  }

  @Get('kelompok')
  listKelompok(@CurrentUser() user: AuthUser, @Query() q: ListKelompokQuery) {
    return this.wilayah.listKelompok(user, q.desaId);
  }

  @Post('kelompok')
  @Roles('ADMIN')
  createKelompok(@CurrentUser() user: AuthUser, @Body() dto: CreateKelompokDto) {
    return this.wilayah.createKelompok(user, dto);
  }

  @Patch('kelompok/:id')
  @Roles('ADMIN')
  updateKelompok(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateKelompokDto,
  ) {
    return this.wilayah.updateKelompok(user, id, dto);
  }
}
