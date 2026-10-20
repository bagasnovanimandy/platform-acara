import { Global, Module } from '@nestjs/common';
import { WaController } from './wa.controller.js';
import { WaService } from './wa.service.js';

@Global()
@Module({ controllers: [WaController], providers: [WaService], exports: [WaService] })
export class WaModule {}
