import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';

@Module({
  providers: [PrismaService, PermissionsService],
  controllers: [PermissionsController],
})
export class PermissionsModule {}
