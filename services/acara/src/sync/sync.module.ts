import { Module } from '@nestjs/common';
import { RekapModule } from '../rekap/rekap.module.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

@Module({ imports: [RekapModule], controllers: [SyncController], providers: [SyncService] })
export class SyncModule {}
