import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { HrmModule } from './hrm/hrm.module';
import { ReportsController } from './reports.controller';
import { AssetsModule } from './assets/assets.module';
import { PermissionsModule } from './permissions/permissions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    HrmModule,
  AssetsModule,
  PermissionsModule,
  ],
  controllers: [ReportsController],
  providers: [PrismaService],
})
export class AppModule {}
