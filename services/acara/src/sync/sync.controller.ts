import { Controller, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import { SyncService } from './sync.service.js';

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /** Tarik ulang data anggota dari core (bila event sempat hilang). */
  @Post('anggota')
  @Roles('SUPER_ADMIN')
  async anggota(@Query('full') full?: string) {
    return { diperbarui: await this.sync.resync(full === 'true') };
  }
}
