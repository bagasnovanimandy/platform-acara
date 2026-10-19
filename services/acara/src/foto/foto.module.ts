import { Module } from '@nestjs/common';
import { AcaraModule } from '../acara/acara.module.js';
import { FotoController } from './foto.controller.js';
import { FotoService } from './foto.service.js';

@Module({ imports: [AcaraModule], controllers: [FotoController], providers: [FotoService] })
export class FotoModule {}
