import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingModule } from '../messaging/messaging.module';
import { NotificationsService } from './notifications.service';
import { AnnouncementsService } from './announcements.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [MessagingModule],
  providers: [PrismaService, NotificationsService, AnnouncementsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
