import { Module } from '@nestjs/common';
import { AcaraModule } from '../acara/acara.module.js';
import { RekapModule } from '../rekap/rekap.module.js';
import { MonitorBus } from './monitor-bus.js';
import { OpController, OperatorAdminController, SesiKehadiranController } from './op.controller.js';
import { OpService } from './op.service.js';
import { OperatorGuard } from './operator.guard.js';
import { PintuService } from './pintu.service.js';

@Module({
  imports: [AcaraModule, RekapModule],
  controllers: [OpController, SesiKehadiranController, OperatorAdminController],
  providers: [OpService, PintuService, MonitorBus, OperatorGuard],
})
export class OpModule {}
