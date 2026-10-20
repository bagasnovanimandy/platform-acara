import { Module } from '@nestjs/common';
import { AcaraModule } from '../acara/acara.module.js';
import { RekapController } from './rekap.controller.js';
import { RekapService } from './rekap.service.js';

@Module({
  imports: [AcaraModule],
  controllers: [RekapController],
  providers: [RekapService],
  exports: [RekapService],
})
export class RekapModule {}
