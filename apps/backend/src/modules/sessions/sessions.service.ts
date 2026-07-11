import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateSessionParams {
  userId: string;
  sessionId: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  deviceModel?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  platform?: string;
  rememberMe?: boolean;
  authMethod?: string;
}

@Injectable()
export class SessionsService {
  // In-memory cache: sessionId → { valid, expiresMs }
  private validityCache = new Map<string, { valid: boolean; exp: number }>();
  private readonly CACHE_TTL_MS = 30_000;

  constructor(private prisma: PrismaService) {}

  async createSession(params: CreateSessionParams) {
    return this.prisma.session.create({
      data: {
        id: params.sessionId,
        userId: params.userId,
        expiresAt: params.expiresAt,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent?.slice(0, 500),
        deviceType: params.deviceType,
        deviceModel: params.deviceModel?.slice(0, 100),
        browser: params.browser,
        browserVersion: params.browserVersion,
        os: params.os,
        platform: params.platform,
        rememberMe: params.rememberMe ?? false,
        authMethod: params.authMethod ?? 'password',
      },
    });
  }

  async isSessionValid(sessionId: string): Promise<boolean> {
    const now = Date.now();
    const cached = this.validityCache.get(sessionId);
    if (cached && now < cached.exp) return cached.valid;

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { isRevoked: true, expiresAt: true },
    });
    const valid = !!(session && !session.isRevoked && session.expiresAt > new Date());
    this.validityCache.set(sessionId, { valid, exp: now + this.CACHE_TTL_MS });
    return valid;
  }

  // Update lastSeenAt without blocking the request
  touchSession(sessionId: string) {
    this.prisma.session
      .update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  invalidateCache(sessionId: string) {
    this.validityCache.delete(sessionId);
  }

  async revokeSession(sessionId: string, revokedById: string) {
    this.invalidateCache(sessionId);
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true, revokedAt: new Date(), revokedById },
    });
  }

  // Revoke all sessions for a user, optionally keeping one (e.g., current session after password change)
  async revokeUserSessions(userId: string, exceptSessionId?: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      select: { id: true },
    });
    sessions.forEach((s) => this.invalidateCache(s.id));

    return this.prisma.session.updateMany({
      where: {
        userId,
        isRevoked: false,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { isRevoked: true, revokedAt: new Date(), revokedById: userId },
    });
  }

  // Get active (non-revoked, non-expired) sessions for a specific user
  async getUserSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
    });
    return sessions.map((s) => ({ ...s, isCurrent: s.id === currentSessionId }));
  }

  // Admin: list all sessions with user details
  async list(opts: {
    page?: number;
    limit?: number;
    userId?: string;
    includeRevoked?: boolean;
    onlineOnly?: boolean;
  }) {
    const page = opts.page ?? 1;
    const limit = Math.min(opts.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const where: any = {
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(opts.includeRevoked
        ? {}
        : { isRevoked: false, expiresAt: { gt: new Date() } }),
      ...(opts.onlineOnly ? { lastSeenAt: { gt: fiveMinAgo } } : {}),
    };

    const [sessions, total] = await Promise.all([
      this.prisma.session.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true },
          },
        },
        orderBy: { lastSeenAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.session.count({ where }),
    ]);

    return { sessions, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // Admin: revoke all active sessions system-wide
  async revokeAll(adminId: string) {
    this.validityCache.clear();
    return this.prisma.session.updateMany({
      where: { isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date(), revokedById: adminId },
    });
  }

  async stats() {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const [active, online, totalRevoked] = await Promise.all([
      this.prisma.session.count({ where: { isRevoked: false, expiresAt: { gt: now } } }),
      this.prisma.session.count({
        where: { isRevoked: false, expiresAt: { gt: now }, lastSeenAt: { gt: fiveMinAgo } },
      }),
      this.prisma.session.count({ where: { isRevoked: true } }),
    ]);
    return { active, online, totalRevoked };
  }

  // Purge expired sessions older than N days (called periodically)
  async purgeExpired(olderThanDays = 30) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    return this.prisma.session.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
  }
}
