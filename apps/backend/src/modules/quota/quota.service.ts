import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QuotaService {
  constructor(private prisma: PrismaService) {}

  // ── Period helpers ────────────────────────────────────────────

  private periodStart(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  private periodEnd(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }

  // ── Get or create quota for a user+provider ───────────────────

  async getOrCreate(userId: string, providerType: string): Promise<any> {
    let quota = await this.prisma.userQuota.findUnique({
      where: { userId_providerType: { userId, providerType } },
    });

    // Auto-reset if period has passed
    if (quota && new Date() >= quota.periodEnd) {
      quota = await this.prisma.userQuota.update({
        where: { id: quota.id },
        data: { usedTokens: 0, periodStart: this.periodStart(), periodEnd: this.periodEnd() },
      });
    }

    if (!quota) {
      // Look up default quota for this provider
      const def = await this.prisma.defaultQuota.findUnique({ where: { providerType } });
      quota = await this.prisma.userQuota.create({
        data: {
          userId,
          providerType,
          monthlyLimit: def?.monthlyLimit ?? 0,
          usedTokens: 0,
          periodStart: this.periodStart(),
          periodEnd: this.periodEnd(),
        },
      });
    }

    return this.enrich(quota);
  }

  // ── Check if user can proceed ─────────────────────────────────

  async check(userId: string, providerType: string): Promise<void> {
    const quota = await this.getOrCreate(userId, providerType);
    if (quota.monthlyLimit === 0) return; // unlimited
    if (quota.usedTokens >= quota.monthlyLimit) {
      throw new BadRequestException(
        `سقف ماهانه توکن برای این سرویس (${quota.monthlyLimit.toLocaleString()} توکن) تمام شده است.`,
      );
    }
  }

  // ── Increment usage after a request ──────────────────────────

  async increment(userId: string, providerType: string, tokens: number): Promise<void> {
    if (tokens <= 0) return;
    await this.prisma.userQuota.upsert({
      where: { userId_providerType: { userId, providerType } },
      update: { usedTokens: { increment: tokens } },
      create: {
        userId,
        providerType,
        monthlyLimit: 0,
        usedTokens: tokens,
        periodStart: this.periodStart(),
        periodEnd: this.periodEnd(),
      },
    });
  }

  // ── User: list all own quotas ─────────────────────────────────

  async listForUser(userId: string) {
    const quotas = await this.prisma.userQuota.findMany({ where: { userId } });
    // Ensure auto-reset
    const now = new Date();
    const results = [];
    for (const q of quotas) {
      if (now >= q.periodEnd) {
        const updated = await this.prisma.userQuota.update({
          where: { id: q.id },
          data: { usedTokens: 0, periodStart: this.periodStart(), periodEnd: this.periodEnd() },
        });
        results.push(this.enrich(updated));
      } else {
        results.push(this.enrich(q));
      }
    }
    return results;
  }

  // ── Admin: list quotas for a specific user ────────────────────

  async listForAdmin(userId: string) {
    const quotas = await this.prisma.userQuota.findMany({ where: { userId } });
    return quotas.map(q => this.enrich(q));
  }

  // ── Admin: list all quotas with user info ─────────────────────

  async listAll(page = 1, limit = 50) {
    const [quotas, total] = await Promise.all([
      this.prisma.userQuota.findMany({
        include: { user: { select: { id: true, firstName: true, lastName: true, phone: true, role: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.userQuota.count(),
    ]);
    return { data: quotas.map(q => this.enrich(q)), total, page, limit };
  }

  // ── Admin: upsert quota for a user ───────────────────────────

  async upsert(userId: string, providerType: string, monthlyLimit: number) {
    const q = await this.prisma.userQuota.upsert({
      where: { userId_providerType: { userId, providerType } },
      update: { monthlyLimit },
      create: {
        userId,
        providerType,
        monthlyLimit,
        usedTokens: 0,
        periodStart: this.periodStart(),
        periodEnd: this.periodEnd(),
      },
    });
    return this.enrich(q);
  }

  // ── Admin: reset usage for a user+provider ────────────────────

  async reset(userId: string, providerType: string) {
    const q = await this.prisma.userQuota.update({
      where: { userId_providerType: { userId, providerType } },
      data: { usedTokens: 0, periodStart: this.periodStart(), periodEnd: this.periodEnd() },
    });
    return this.enrich(q);
  }

  // ── Default quotas ────────────────────────────────────────────

  async listDefaults() {
    return this.prisma.defaultQuota.findMany({ orderBy: { providerType: 'asc' } });
  }

  async upsertDefault(providerType: string, monthlyLimit: number) {
    return this.prisma.defaultQuota.upsert({
      where: { providerType },
      update: { monthlyLimit },
      create: { providerType, monthlyLimit },
    });
  }

  async deleteDefault(providerType: string) {
    return this.prisma.defaultQuota.delete({ where: { providerType } });
  }

  // ── Admin: platform-wide stats ────────────────────────────────

  async globalStats() {
    const [totalUsers, totalRequests, tokenStats, topUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.aiUsage.count(),
      this.prisma.aiUsage.aggregate({
        _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
      }),
      this.prisma.aiUsage.groupBy({
        by: ['userId'],
        _sum: { totalTokens: true },
        orderBy: { _sum: { totalTokens: 'desc' } },
        take: 10,
      }),
    ]);

    const topUserIds = topUsers.map(u => u.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: topUserIds } },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return {
      totalUsers,
      totalRequests,
      totalTokens: tokenStats._sum.totalTokens || 0,
      promptTokens: tokenStats._sum.promptTokens || 0,
      completionTokens: tokenStats._sum.completionTokens || 0,
      topUsers: topUsers.map(u => ({
        user: userMap.get(u.userId),
        totalTokens: u._sum.totalTokens || 0,
      })),
    };
  }

  // ── Enrich quota with computed fields ─────────────────────────

  private enrich(q: any) {
    const remaining = q.monthlyLimit === 0 ? null : Math.max(0, q.monthlyLimit - q.usedTokens);
    const pct = q.monthlyLimit === 0 ? 0 : Math.min(100, Math.round((q.usedTokens / q.monthlyLimit) * 100));
    const status = q.monthlyLimit === 0 ? 'unlimited' : pct >= 90 ? 'critical' : pct >= 70 ? 'warning' : 'normal';
    return { ...q, remaining, usagePercent: pct, status };
  }
}
