import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Provider fields safe to expose alongside a quota (never the apiKey)
const PROVIDER_SELECT = { id: true, name: true, type: true, model: true, isActive: true } as const;

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

  // ── Get or create quota for a user+model ──────────────────────

  async getOrCreate(userId: string, providerId: string): Promise<any> {
    let quota = await this.prisma.userQuota.findUnique({
      where: { userId_providerId: { userId, providerId } },
      include: { provider: { select: PROVIDER_SELECT } },
    });

    // Auto-reset if period has passed
    if (quota && new Date() >= quota.periodEnd) {
      quota = await this.prisma.userQuota.update({
        where: { id: quota.id },
        data: { usedTokens: 0, periodStart: this.periodStart(), periodEnd: this.periodEnd() },
        include: { provider: { select: PROVIDER_SELECT } },
      });
    }

    if (!quota) {
      // Look up default quota for this model
      const def = await this.prisma.defaultQuota.findUnique({ where: { providerId } });
      quota = await this.prisma.userQuota.create({
        data: {
          userId,
          providerId,
          monthlyLimit: def?.monthlyLimit ?? 0,
          usedTokens: 0,
          periodStart: this.periodStart(),
          periodEnd: this.periodEnd(),
        },
        include: { provider: { select: PROVIDER_SELECT } },
      });
    }

    return this.enrich(quota);
  }

  // ── Check if user can proceed ─────────────────────────────────

  async check(userId: string, providerId: string): Promise<void> {
    const quota = await this.getOrCreate(userId, providerId);
    if (quota.monthlyLimit === 0) return; // unlimited
    if (quota.usedTokens >= quota.monthlyLimit) {
      const label = quota.provider?.name || 'این مدل';
      throw new BadRequestException(
        `سقف ماهانه توکن برای «${label}» (${quota.monthlyLimit.toLocaleString()} توکن) تمام شده است.`,
      );
    }
  }

  // ── Increment usage after a request ──────────────────────────

  async increment(userId: string, providerId: string, tokens: number): Promise<void> {
    if (tokens <= 0) return;
    const def = await this.prisma.defaultQuota.findUnique({ where: { providerId } });
    await this.prisma.userQuota.upsert({
      where: { userId_providerId: { userId, providerId } },
      update: { usedTokens: { increment: tokens } },
      create: {
        userId,
        providerId,
        monthlyLimit: def?.monthlyLimit ?? 0,
        usedTokens: tokens,
        periodStart: this.periodStart(),
        periodEnd: this.periodEnd(),
      },
    });
  }

  // ── User: list all own quotas ─────────────────────────────────

  async listForUser(userId: string) {
    const quotas = await this.prisma.userQuota.findMany({
      where: { userId },
      include: { provider: { select: PROVIDER_SELECT } },
    });
    // Ensure auto-reset
    const now = new Date();
    const results = [];
    for (const q of quotas) {
      if (now >= q.periodEnd) {
        const updated = await this.prisma.userQuota.update({
          where: { id: q.id },
          data: { usedTokens: 0, periodStart: this.periodStart(), periodEnd: this.periodEnd() },
          include: { provider: { select: PROVIDER_SELECT } },
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
    const quotas = await this.prisma.userQuota.findMany({
      where: { userId },
      include: { provider: { select: PROVIDER_SELECT } },
    });
    return quotas.map(q => this.enrich(q));
  }

  // ── Admin: list all quotas with user + model info ─────────────

  async listAll(page = 1, limit = 50) {
    const [quotas, total] = await Promise.all([
      this.prisma.userQuota.findMany({
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true, role: true } },
          provider: { select: PROVIDER_SELECT },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.userQuota.count(),
    ]);
    return { data: quotas.map(q => this.enrich(q)), total, page, limit };
  }

  // ── Admin: upsert quota override for a user+model ─────────────

  async upsert(userId: string, providerId: string, monthlyLimit: number) {
    const q = await this.prisma.userQuota.upsert({
      where: { userId_providerId: { userId, providerId } },
      update: { monthlyLimit },
      create: {
        userId,
        providerId,
        monthlyLimit,
        usedTokens: 0,
        periodStart: this.periodStart(),
        periodEnd: this.periodEnd(),
      },
      include: { provider: { select: PROVIDER_SELECT } },
    });
    return this.enrich(q);
  }

  // ── Admin: reset usage for a user+model ───────────────────────

  async reset(userId: string, providerId: string) {
    const q = await this.prisma.userQuota.update({
      where: { userId_providerId: { userId, providerId } },
      data: { usedTokens: 0, periodStart: this.periodStart(), periodEnd: this.periodEnd() },
      include: { provider: { select: PROVIDER_SELECT } },
    });
    return this.enrich(q);
  }

  // ── Default quotas (per model) ────────────────────────────────

  async listDefaults() {
    const defaults = await this.prisma.defaultQuota.findMany({
      include: { provider: { select: PROVIDER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
    return defaults;
  }

  async upsertDefault(providerId: string, monthlyLimit: number) {
    const provider = await this.prisma.aiProvider.findUnique({ where: { id: providerId } });
    if (!provider) throw new BadRequestException('مدل انتخاب‌شده یافت نشد');
    return this.prisma.defaultQuota.upsert({
      where: { providerId },
      update: { monthlyLimit },
      create: { providerId, monthlyLimit },
      include: { provider: { select: PROVIDER_SELECT } },
    });
  }

  async deleteDefault(providerId: string) {
    return this.prisma.defaultQuota.delete({ where: { providerId } });
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
