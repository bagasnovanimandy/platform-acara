import { Module } from '@nestjs/common';
import { OperatorGuard } from '../op/operator.guard.js';
import { FaceController, OpFaceController } from './face.controller.js';
import { FaceService } from './face.service.js';
import { FaceBus } from './face-bus.js';

@Module({
  controllers: [OpFaceController, FaceController],
  providers: [FaceService, FaceBus, OperatorGuard],
})
export class FaceModule {}
