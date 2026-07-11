import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PresenceService {
  // userId → Set<socketId> (multiple tabs / devices)
  private readonly connected = new Map<string, Set<string>>();

  constructor(private prisma: PrismaService) {}

  async connect(userId: string, socketId: string) {
    if (!this.connected.has(userId)) this.connected.set(userId, new Set());
    this.connected.get(userId)!.add(socketId);
    await this.prisma.userPresence.upsert({
      where: { userId },
      create: { userId, status: 'ONLINE', lastSeenAt: new Date() },
      update: { status: 'ONLINE', lastSeenAt: new Date() },
    });
  }

  async disconnect(userId: string, socketId: string) {
    const sockets = this.connected.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.connected.delete(userId);
        await this.prisma.userPresence.update({
          where: { userId },
          data: { status: 'OFFLINE', lastSeenAt: new Date() },
        }).catch(() => {});
      }
    }
  }

  isOnline(userId: string): boolean {
    return (this.connected.get(userId)?.size ?? 0) > 0;
  }

  getOnlineCount(): number {
    return this.connected.size;
  }

  getOnlineUserIds(): string[] {
    return [...this.connected.keys()];
  }

  async heartbeat(userId: string) {
    await this.prisma.userPresence.upsert({
      where: { userId },
      create: { userId, status: 'ONLINE', lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    });
  }
}
