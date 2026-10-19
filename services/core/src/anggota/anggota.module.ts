import { Global, Module } from '@nestjs/common';
import { AnggotaPublisher } from './anggota-publisher.service.js';
import { AnggotaController } from './anggota.controller.js';
import { AnggotaService } from './anggota.service.js';

@Global()
@Module({
  controllers: [AnggotaController],
  providers: [AnggotaService, AnggotaPublisher],
  exports: [AnggotaPublisher],
})
export class AnggotaModule {}
