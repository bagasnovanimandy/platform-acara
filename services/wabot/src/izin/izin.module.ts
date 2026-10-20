import { Module } from '@nestjs/common';
import { IzinController } from './izin.controller.js';
import { IzinService } from './izin.service.js';

@Module({ controllers: [IzinController], providers: [IzinService], exports: [IzinService] })
export class IzinModule {}
