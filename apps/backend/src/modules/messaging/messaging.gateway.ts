import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PresenceService } from './presence.service';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { SessionsService } from '../sessions/sessions.service';
import { AuthSettingsService } from '../auth-settings/auth-settings.service';

@WebSocketGateway({
  cors: { origin: (_: string, cb: Function) => cb(null, true), credentials: true },
  transports: ['websocket', 'polling'],
})
@Injectable()
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private presence: PresenceService,
    private convs: ConversationsService,
    private msgs: MessagesService,
    private sessions: SessionsService,
    private authSettings: AuthSettingsService,
  ) {}

  private async verifySocket(socket: Socket): Promise<{ userId: string; role: string } | null> {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization as string | undefined)?.replace('Bearer ', '');
    if (!token) return null;
    try {
      const secret = this.config.get<string>('JWT_SECRET') || 'devsecret';
      const payload = this.jwt.verify<any>(token, { secret });

      if (payload.gtv !== undefined) {
        const settings = await this.authSettings.get();
        if (payload.gtv !== settings.globalTokenVersion) return null;
      }
      if (payload.sid) {
        const valid = await this.sessions.isSessionValid(payload.sid);
        if (!valid) return null;
      }
      return { userId: payload.sub, role: payload.role };
    } catch {
      return null;
    }
  }

  async handleConnection(socket: Socket) {
    const user = await this.verifySocket(socket);
    if (!user) {
      socket.emit('error', { message: 'Unauthorized' });
      socket.disconnect();
      return;
    }

    socket.data.userId = user.userId;
    socket.data.role = user.role;

    socket.join(`user:${user.userId}`);
    await this.presence.connect(user.userId, socket.id);

    const convIds = await this.convs.getUserConversationIds(user.userId);
    convIds.forEach((id) => socket.join(`conv:${id}`));

    this.server.emit('presence:update', { userId: user.userId, status: 'ONLINE' });
    socket.emit('connected', {
      userId: user.userId,
      onlineCount: this.presence.getOnlineCount(),
      onlineUserIds: this.presence.getOnlineUserIds(),
    });
  }

  async handleDisconnect(socket: Socket) {
    if (!socket.data?.userId) return;
    const { userId } = socket.data;
    await this.presence.disconnect(userId, socket.id);
    if (!this.presence.isOnline(userId)) {
      this.server.emit('presence:update', { userId, status: 'OFFLINE' });
    }
  }

  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string; content?: string; type?: string; replyToId?: string },
  ) {
    if (!socket.data?.userId) return;
    const VALID_TYPES = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'];
    if (!VALID_TYPES.includes(data.type ?? '')) return;
    if (!data.content?.trim() && data.type === 'TEXT') return;
    if (!(await this.convs.isMember(data.conversationId, socket.data.userId))) return;
    const msg = await this.msgs.create({
      conversationId: data.conversationId,
      senderId: socket.data.userId,
      content: data.content,
      type: data.type,
      replyToId: data.replyToId,
    });
    this.server.to(`conv:${data.conversationId}`).emit('message:new', msg);
    return { ok: true, message: msg };
  }

  @SubscribeMessage('message:edit')
  async onEdit(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string; content: string },
  ) {
    if (!socket.data?.userId) return;
    try {
      const msg = await this.msgs.edit(data.messageId, socket.data.userId, data.content);
      this.server.to(`conv:${msg.conversationId}`).emit('message:edited', msg);
    } catch {}
  }

  @SubscribeMessage('message:delete')
  async onDelete(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string; forAll?: boolean },
  ) {
    if (!socket.data?.userId) return;
    try {
      const msg = await this.msgs.getById(data.messageId);
      if (!msg) return;
      await this.msgs.softDelete(data.messageId, socket.data.userId, data.forAll);
      this.server.to(`conv:${msg.conversationId}`).emit('message:deleted', {
        messageId: data.messageId,
        conversationId: msg.conversationId,
        forAll: data.forAll,
      });
    } catch {}
  }

  @SubscribeMessage('typing:start')
  onTypingStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!socket.data?.userId) return;
    socket.to(`conv:${data.conversationId}`).emit('typing:start', {
      userId: socket.data.userId,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('typing:stop')
  onTypingStop(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!socket.data?.userId) return;
    socket.to(`conv:${data.conversationId}`).emit('typing:stop', {
      userId: socket.data.userId,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('message:read')
  async onRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!socket.data?.userId) return;
    await this.msgs.markRead(data.conversationId, socket.data.userId);
    socket.to(`conv:${data.conversationId}`).emit('read:update', {
      conversationId: data.conversationId,
      userId: socket.data.userId,
      readAt: new Date().toISOString(),
    });
  }

  @SubscribeMessage('reaction:toggle')
  async onReaction(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string; emoji: string },
  ) {
    if (!socket.data?.userId) return;
    try {
      const msg = await this.msgs.getById(data.messageId);
      if (!msg) return;
      const result = await this.msgs.toggleReaction(data.messageId, socket.data.userId, data.emoji);
      this.server.to(`conv:${msg.conversationId}`).emit('reaction:update', {
        messageId: data.messageId,
        conversationId: msg.conversationId,
        userId: socket.data.userId,
        emoji: data.emoji,
        added: result.added,
      });
    } catch {}
  }

  @SubscribeMessage('presence:heartbeat')
  async onHeartbeat(@ConnectedSocket() socket: Socket) {
    if (socket.data?.userId) await this.presence.heartbeat(socket.data.userId);
  }

  // Called by MessagingController after REST operations
  notifyConversation(convId: string, event: string, data: unknown) {
    this.server.to(`conv:${convId}`).emit(event, data);
  }

  notifyUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  joinAllSockets(userId: string, convId: string) {
    this.server.in(`user:${userId}`).socketsJoin(`conv:${convId}`);
  }
}
