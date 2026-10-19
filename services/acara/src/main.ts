import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3002);
  await app.listen(port);
  Logger.log(`acara-svc berjalan di port ${port}`, 'Bootstrap');
}

void bootstrap();
