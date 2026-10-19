import { Module } from '@nestjs/common';
import { AcaraController, AnggotaAcaraController } from './acara.controller.js';
import { AcaraService } from './acara.service.js';

@Module({
  controllers: [AcaraController, AnggotaAcaraController],
  providers: [AcaraService],
  exports: [AcaraService],
})
export class AcaraModule {}
