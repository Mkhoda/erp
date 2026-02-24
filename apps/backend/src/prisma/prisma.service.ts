import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      // In local development, allow the app to start even if the database
      // is not reachable yet. Log the error for debugging.
      // Use a safe cast because `err` is `unknown` under `--useUnknownInCatchVariables`.
      // eslint-disable-next-line no-console
      console.warn('[Prisma] could not connect on init:', (err as any)?.message ?? String(err));
    }
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
