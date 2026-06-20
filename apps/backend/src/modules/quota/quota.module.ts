import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotaController } from './quota.controller';
import { QuotaService } from './quota.service';

@Module({
  controllers: [QuotaController],
  providers: [QuotaService, PrismaService],
  exports: [QuotaService],
})
export class QuotaModule {}
