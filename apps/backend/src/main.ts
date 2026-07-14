import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
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
  app.setGlobalPrefix('api');
  app.useWebSocketAdapter(new IoAdapter(app));
  // enableImplicitConversion so query-string DTOs (e.g. ?page=1&limit=20) get
  // their declared number/boolean fields coerced before @IsInt()/@IsBoolean()
  // run — without it every such field needs an explicit @Type() decorator or
  // validation 400s on the (always-string) query value. This was missed on
  // TicketFilterDto and AnnouncementFilterDto/NotificationFilterDto; fixing it
  // globally here prevents the same bug in every future query DTO.
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  // Default to 3001 to avoid clashing with Next.js dev server on 3000
  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
}

bootstrap();
