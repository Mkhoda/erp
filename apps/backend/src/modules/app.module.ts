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
import { LogsModule } from './logs/logs.module';
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
    LogsModule,
  ],
  controllers: [ReportsController],
  providers: [
    PrismaService,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
