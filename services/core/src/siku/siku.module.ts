import { Module } from '@nestjs/common';
import { SikuInternalController, SikuSsoController } from './siku.controller.js';
import { SikuService } from './siku.service.js';

@Module({ controllers: [SikuSsoController, SikuInternalController], providers: [SikuService] })
export class SikuModule {}
