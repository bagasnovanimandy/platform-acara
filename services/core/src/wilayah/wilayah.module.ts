import { Module } from '@nestjs/common';
import { WilayahController } from './wilayah.controller.js';
import { WilayahService } from './wilayah.service.js';

@Module({ controllers: [WilayahController], providers: [WilayahService] })
export class WilayahModule {}
