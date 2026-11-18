import { Module } from '@nestjs/common';
import { RequestLogsController } from './request-logs.controller';

@Module({
  controllers: [RequestLogsController],
})
export class RequestLogsModule {}
