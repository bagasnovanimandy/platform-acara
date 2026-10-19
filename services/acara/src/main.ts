import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { z } from 'zod';
import { AppModule } from './app.module.js';

z.config(z.locales.id());

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Pendaftaran wajah membawa 5 thumbnail base64.
  app.useBodyParser('json', { limit: '2mb' });
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3002);
  await app.listen(port);
  Logger.log(`acara-svc berjalan di port ${port}`, 'Bootstrap');
}

void bootstrap();
