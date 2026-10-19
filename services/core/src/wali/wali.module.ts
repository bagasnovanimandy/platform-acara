import { Module } from '@nestjs/common';
import { WaliController } from './wali.controller.js';
import { WaliService } from './wali.service.js';

@Module({ controllers: [WaliController], providers: [WaliService] })
export class WaliModule {}
