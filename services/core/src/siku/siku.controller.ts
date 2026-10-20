import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../auth/decorators.js';
import { InternalKeyGuard } from '../auth/guards.js';
import { ImporSikuDto } from './siku.dto.js';
import { SikuService } from './siku.service.js';

@Controller('auth/sso')
export class SikuSsoController {
  constructor(private readonly siku: SikuService) {}

  /** Buat URL masuk ke SiKU untuk user yang sedang login. */
  @Post('siku')
  @HttpCode(200)
  masuk(@CurrentUser() user: AuthUser) {
    return this.siku.urlMasuk(user);
  }
}

/** Impor pengguna SiKU (dipanggil skrip sinkronisasi di SiKU, header x-internal-key). */
@Controller('internal/siku')
@Public()
@UseGuards(InternalKeyGuard)
export class SikuInternalController {
  constructor(private readonly siku: SikuService) {}

  @Post('users/import')
  @HttpCode(200)
  impor(@Body() dto: ImporSikuDto) {
    return this.siku.impor(dto);
  }
}
