import {
  Controller, Get, Post, Patch, Param, Query, Body,
  Req, UseGuards, UseInterceptors, UploadedFile,
  ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { MessagingGateway } from './messaging.gateway';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('messaging')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(
    private convs: ConversationsService,
    private msgs: MessagesService,
    private gateway: MessagingGateway,
    private prisma: PrismaService,
  ) {}

  @Get('conversations')
  getConversations(@Req() req: any) {
    return this.convs.listForUser(req.user.userId);
  }

  @Post('conversations')
  async createConversation(@Req() req: any, @Body() body: { userId: string }) {
    if (!body.userId) throw new BadRequestException('userId required');
    const conv = await this.convs.findOrCreateDirect(req.user.userId, body.userId);
    this.gateway.joinAllSockets(req.user.userId, conv.id);
    this.gateway.joinAllSockets(body.userId, conv.id);
    return conv;
  }

  @Get('conversations/:id')
  async getConversation(@Req() req: any, @Param('id') id: string) {
    const conv = await this.convs.get(id, req.user.userId);
    if (!conv) throw new ForbiddenException();
    return conv;
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Req() req: any,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    if (!(await this.convs.isMember(id, req.user.userId))) throw new ForbiddenException();
    return this.msgs.list(id, cursor, limit ? parseInt(limit, 10) : 30);
  }

  @Post('conversations/:id/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/chat',
        filename: (_, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadFile(
    @Req() req: any,
    @Param('id') convId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!(await this.convs.isMember(convId, req.user.userId))) throw new ForbiddenException();
    if (!file) throw new BadRequestException('No file provided');

    const type = getMsgType(file.mimetype);
    const msg = await this.msgs.create({
      conversationId: convId,
      senderId: req.user.userId,
      type,
      content: file.originalname,
      attachmentData: {
        url: `/uploads/chat/${file.filename}`,
        name: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        type,
      },
    });
    this.gateway.notifyConversation(convId, 'message:new', msg);
    return msg;
  }

  @Get('unread')
  async getUnread(@Req() req: any) {
    const count = await this.msgs.getUnreadCount(req.user.userId);
    return { count };
  }

  @Get('users')
  getUsers(@Req() req: any) {
    return this.convs.listUsers(req.user.userId);
  }

  // Admin endpoints
  @Get('settings')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getSettings() {
    return this.prisma.chatSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });
  }

  @Patch('settings')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async updateSettings(@Body() body: any, @Req() req: any) {
    return this.prisma.chatSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...body, updatedById: req.user.userId },
      update: { ...body, updatedById: req.user.userId },
    });
  }
}

function getMsgType(mime: string): string {
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  return 'DOCUMENT';
}
