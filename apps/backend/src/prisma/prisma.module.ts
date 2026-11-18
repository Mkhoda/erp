import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// One PrismaClient (one connection pool) for the whole app. Never list PrismaService in a
// feature module's `providers` — every such listing created its own client and pool, and
// ~20 of them exhausted Postgres' max_connections ("sorry, too many clients already").
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
