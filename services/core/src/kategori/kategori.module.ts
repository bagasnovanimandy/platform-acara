import { Module } from '@nestjs/common';
import { KategoriController } from './kategori.controller.js';
import { KategoriService } from './kategori.service.js';

@Module({ controllers: [KategoriController], providers: [KategoriService] })
export class KategoriModule {}
