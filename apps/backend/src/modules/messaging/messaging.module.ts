import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionsModule } from '../sessions/sessions.module';
import { AuthSettingsModule } from '../auth-settings/auth-settings.module';
import { PresenceService } from './presence.service';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { MessagingGateway } from './messaging.gateway';
import { MessagingController } from './messaging.controller';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'devsecret',
      }),
      inject: [ConfigService],
    }),
    MulterModule.register({}),
    SessionsModule,
    AuthSettingsModule,
  ],
  providers: [
    PrismaService,
    PresenceService,
    ConversationsService,
    MessagesService,
    MessagingGateway,
  ],
  controllers: [MessagingController],
  exports: [MessagingGateway, PresenceService],
})
export class MessagingModule {}
