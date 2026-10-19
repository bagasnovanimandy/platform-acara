import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { AppModule } from './app.module.js';

z.config(z.locales.id());

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.use(cookieParser());
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  Logger.log(`core-svc berjalan di port ${port}`, 'Bootstrap');
}

void bootstrap();
