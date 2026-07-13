import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { HrmModule } from './hrm/hrm.module';
import { ReportsController } from './reports.controller';
import { AssetsModule } from './assets/assets.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AiSettingsModule } from './ai-settings/ai-settings.module';
import { RequestLogsModule } from './request-logs/request-logs.module';
import { ChatHistoryModule } from './chat-history/chat-history.module';
import { TodosModule } from './todos/todos.module';
import { QuotaModule } from './quota/quota.module';
import { AttendanceModule } from './attendance/attendance.module';
import { SessionsModule } from './sessions/sessions.module';
import { AuthSettingsModule } from './auth-settings/auth-settings.module';
import { MessagingModule } from './messaging/messaging.module';
import { SystemSettingsModule } from './system-settings/system-settings.module';
import { TicketsModule } from './tickets/tickets.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LoggingInterceptor } from '../common/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        process.env.NODE_ENV === 'production' ? '.env.production' : '',
        '.env',
      ].filter(Boolean) as string[],
    }),
    AuthModule,
    HrmModule,
    AssetsModule,
    PermissionsModule,
    AiSettingsModule,
    RequestLogsModule,
    ChatHistoryModule,
    TodosModule,
    QuotaModule,
    AttendanceModule,
    SessionsModule,
    AuthSettingsModule,
    SystemSettingsModule,
    MessagingModule,
    TicketsModule,
    NotificationsModule,
  ],
  controllers: [ReportsController],
  providers: [
    PrismaService,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
