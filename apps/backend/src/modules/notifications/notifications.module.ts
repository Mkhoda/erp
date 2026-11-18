import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { NotificationsService } from './notifications.service';
import { AnnouncementsService } from './announcements.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [MessagingModule],
  providers: [NotificationsService, AnnouncementsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
