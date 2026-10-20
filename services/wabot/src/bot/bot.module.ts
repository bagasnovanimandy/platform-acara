import { Module } from '@nestjs/common';
import { IzinModule } from '../izin/izin.module.js';
import { BotService } from './bot.service.js';
import { KeadaanStore } from './keadaan.store.js';

@Module({ imports: [IzinModule], providers: [BotService, KeadaanStore] })
export class BotModule {}
