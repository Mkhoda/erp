import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Read CORS origin from environment variable
  // If CORS_ONLY_HTTP is set to "1", filter out any https origins
  const rawOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
      ];

  const corsOrigin = process.env.CORS_ONLY_HTTP === '1'
    ? rawOrigins.filter(o => !o.startsWith('https://'))
    : rawOrigins;

  if (process.env.CORS_ONLY_HTTP === '1') {
    console.log('CORS_ONLY_HTTP set: https origins will be ignored');
  }

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  // static for uploaded files
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Default to 3001 to avoid clashing with Next.js dev server on 3000
  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
}

bootstrap();
