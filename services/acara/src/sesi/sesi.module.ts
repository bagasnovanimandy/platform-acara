import { Module } from '@nestjs/common';
import { AcaraModule } from '../acara/acara.module.js';
import { SesiController } from './sesi.controller.js';
import { SesiService } from './sesi.service.js';

@Module({ imports: [AcaraModule], controllers: [SesiController], providers: [SesiService] })
export class SesiModule {}
