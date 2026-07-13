import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { join } from 'path';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { CommentsService } from './comments.service';
import { CategoriesService } from './categories.service';
import { AnalyticsService } from './analytics.service';
import { SlaService } from './sla.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [
    PrismaModule,
    PermissionsModule,
    MulterModule.register({ dest: join(process.cwd(), 'uploads', 'tickets') }),
  ],
  controllers: [TicketsController],
  providers: [TicketsService, CommentsService, CategoriesService, AnalyticsService, SlaService],
  exports: [TicketsService, CategoriesService],
})
export class TicketsModule {}
