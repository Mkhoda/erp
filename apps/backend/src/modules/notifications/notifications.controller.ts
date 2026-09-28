import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request, UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { NotificationsService } from './notifications.service';
import { AnnouncementsService } from './announcements.service';
import {
  NotificationFilterDto, MarkReadDto,
  CreateAnnouncementDto, UpdateAnnouncementDto, AnnouncementFilterDto,
} from './dto/notification.dto';

const annUploadRoot = path.join(process.cwd(), 'uploads', 'announcements');
fs.mkdirSync(annUploadRoot, { recursive: true });

// Files are served from our own origin, so only allow inert document/media
// types — never html/svg/js that a browser would execute.
const ANN_ALLOWED_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.txt',
  '.zip', '.rar', '.7z', '.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.webm', '.mov',
]);

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private notifs: NotificationsService,
    private announcements: AnnouncementsService,
  ) {}

  // ── User notification endpoints ─────────────────────────────────────────

  @Get()
  getMyNotifications(@Request() req: any, @Query() filter: NotificationFilterDto) {
    return this.notifs.getForUser(req.user.id, filter);
  }

  @Get('unread-count')
  getUnreadCount(@Request() req: any) {
    return this.notifs.getUnreadCount(req.user.id);
  }

  @Get('recent')
  getRecent(@Request() req: any) {
    return this.notifs.getRecent(req.user.id);
  }

  @Post('mark-read')
  markRead(@Request() req: any, @Body() dto: MarkReadDto) {
    return this.notifs.markRead(req.user.id, dto);
  }

  @Post('mark-all-read')
  markAllRead(@Request() req: any) {
    return this.notifs.markAllRead(req.user.id);
  }

  @Patch(':id/archive')
  toggleArchive(@Param('id') id: string, @Request() req: any) {
    return this.notifs.toggleArchive(id, req.user.id);
  }

  @Patch(':id/pin')
  togglePin(@Param('id') id: string, @Request() req: any) {
    return this.notifs.togglePin(id, req.user.id);
  }

  @Delete('read')
  deleteRead(@Request() req: any) {
    return this.notifs.deleteAll(req.user.id);
  }

  @Delete(':id')
  deleteOne(@Param('id') id: string, @Request() req: any) {
    return this.notifs.deleteOne(id, req.user.id);
  }

  // ── Analytics (Admin only) ───────────────────────────────────────────────

  @Get('analytics')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getAnalytics() {
    return this.notifs.getAnalytics();
  }

  // ── Announcement endpoints ───────────────────────────────────────────────

  @Get('announcements')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  findAllAnnouncements(@Query() filter: AnnouncementFilterDto) {
    return this.announcements.findAll(filter);
  }

  @Get('announcements/active')
  getActiveAnnouncements(@Request() req: any) {
    return this.announcements.getActiveForUser(req.user.id, {
      role: req.user.role,
      departmentId: req.user.departmentId,
    });
  }

  @Get('announcements/popups')
  getPendingPopups(@Request() req: any) {
    return this.announcements.getPendingPopups(req.user.id, {
      role: req.user.role,
      departmentId: req.user.departmentId,
    });
  }

  @Get('announcements/unread-count')
  getAnnouncementsUnreadCount(@Request() req: any) {
    return this.announcements.getUnreadCount(req.user.id, {
      role: req.user.role,
      departmentId: req.user.departmentId,
    });
  }

  /** Upload one file to attach to an announcement; returns its descriptor. */
  @Post('announcements/upload')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: annUploadRoot,
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ANN_ALLOWED_EXT.has(ext)) return cb(new BadRequestException('این نوع فایل مجاز نیست'), false);
      cb(null, true);
    },
  }))
  uploadAnnouncementFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('فایلی ارسال نشد');
    // multer decodes the multipart filename as latin1; re-decode so Persian names survive
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return {
      url: `/uploads/announcements/${file.filename}`,
      name,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  @Get('announcements/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  findOneAnnouncement(@Param('id') id: string) {
    return this.announcements.findOne(id);
  }

  @Get('announcements/:id/ack-stats')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getAckStats(@Param('id') id: string) {
    return this.announcements.getAckStats(id);
  }

  @Post('announcements')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  createAnnouncement(@Body() dto: CreateAnnouncementDto, @Request() req: any) {
    return this.announcements.create(dto, req.user.id);
  }

  @Patch('announcements/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateAnnouncement(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcements.update(id, dto);
  }

  @Post('announcements/:id/publish')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  publishAnnouncement(@Param('id') id: string) {
    return this.announcements.publish(id);
  }

  @Post('announcements/:id/ack')
  acknowledgeAnnouncement(@Param('id') id: string, @Request() req: any) {
    return this.announcements.acknowledge(id, req.user.id);
  }

  @Post('announcements/:id/seen')
  markPopupSeen(@Param('id') id: string, @Request() req: any) {
    return this.announcements.markPopupSeen(id, req.user.id);
  }

  @Delete('announcements/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  deleteAnnouncement(@Param('id') id: string) {
    return this.announcements.delete(id);
  }
}
