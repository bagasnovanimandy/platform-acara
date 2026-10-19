import { Module } from '@nestjs/common';
import { AcaraModule } from '../acara/acara.module.js';
import { OpController, SesiKehadiranController } from './op.controller.js';
import { OpService } from './op.service.js';
import { OperatorGuard } from './operator.guard.js';

@Module({
  imports: [AcaraModule],
  controllers: [OpController, SesiKehadiranController],
  providers: [OpService, OperatorGuard],
})
export class OpModule {}
