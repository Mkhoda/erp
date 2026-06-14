import { Module } from '@nestjs/common';
import { RequestLogsController } from './request-logs.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [RequestLogsController],
  providers: [PrismaService],
})
export class RequestLogsModule {}
