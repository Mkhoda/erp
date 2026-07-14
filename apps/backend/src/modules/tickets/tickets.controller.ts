import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PagePermissionGuard } from '../permissions/page.guard';
import { Page } from '../permissions/page.decorator';
import { TicketsService } from './tickets.service';
import { CommentsService } from './comments.service';
import { CategoriesService } from './categories.service';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateTicketDto, UpdateTicketDto, AssignTicketDto, TransferTicketDto,
  CreateCommentDto, UpdateCommentDto, CreateCategoryDto, UpdateCategoryDto,
  UpsertDeptConfigDto, TicketFilterDto, UpdateTicketSettingsDto,
} from './dto/ticket.dto';

const uploadDir = join(process.cwd(), 'uploads', 'tickets');

function storage() {
  return diskStorage({
    destination: uploadDir,
    filename: (_, file, cb) => {
      const rand = randomBytes(8).toString('hex');
      cb(null, `${Date.now()}-${rand}${extname(file.originalname)}`);
    },
  });
}

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(
    private tickets: TicketsService,
    private comments: CommentsService,
    private categories: CategoriesService,
    private analytics: AnalyticsService,
    private prisma: PrismaService,
  ) {}

  // ── Ticket CRUD ───────────────────────────────────────────────────

  @Get()
  @UseGuards(PagePermissionGuard)
  @Page('/dashboard/tickets')
  list(@Query() q: TicketFilterDto, @Request() req: any) {
    return this.tickets.findAll(q, req.user);
  }

  @Get('my')
  myTickets(@Query() q: TicketFilterDto, @Request() req: any) {
    const user = req.user;
    // Managers/Experts in manager-type role see their dept tickets;
    // regular users see only their own submitted tickets
    if (user.role === 'MANAGER') {
      return this.tickets.findAll(q, user);
    }
    return this.tickets.findAll({ ...q, requesterId: user.id }, { ...user, role: 'ADMIN' as any });
  }

  @Get('notifications')
  getNotifications(@Request() req: any) {
    return this.tickets.getMyNotifications(req.user.id);
  }

  @Patch('notifications/read-all')
  markAllRead(@Request() req: any) {
    return this.tickets.markAllNotificationsRead(req.user.id);
  }

  @Patch('notifications/:id/read')
  markRead(@Param('id') id: string, @Request() req: any) {
    return this.tickets.markNotificationRead(id, req.user.id);
  }

  @Post()
  create(@Body() dto: CreateTicketDto, @Request() req: any) {
    return this.tickets.create(dto, req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.tickets.findOne(id, req.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto, @Request() req: any) {
    return this.tickets.update(id, dto, req.user);
  }

  @Patch(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignTicketDto, @Request() req: any) {
    return this.tickets.assign(id, dto, req.user);
  }

  @Patch(':id/transfer')
  transfer(@Param('id') id: string, @Body() dto: TransferTicketDto, @Request() req: any) {
    return this.tickets.transfer(id, dto, req.user);
  }

  @Patch(':id/close')
  close(@Param('id') id: string, @Request() req: any) {
    return this.tickets.closeTicket(id, req.user);
  }

  @Patch(':id/reopen')
  reopen(@Param('id') id: string, @Request() req: any) {
    return this.tickets.reopenTicket(id, req.user);
  }

  // ── Comments ──────────────────────────────────────────────────────

  @Post(':id/comments')
  addComment(@Param('id') ticketId: string, @Body() dto: CreateCommentDto, @Request() req: any) {
    return this.comments.create(ticketId, dto, req.user.id, req.user.role);
  }

  @Patch('comments/:commentId')
  updateComment(@Param('commentId') commentId: string, @Body() dto: UpdateCommentDto, @Request() req: any) {
    return this.comments.update(commentId, dto, req.user.id);
  }

  @Delete('comments/:commentId')
  deleteComment(@Param('commentId') commentId: string, @Request() req: any) {
    return this.comments.softDelete(commentId, req.user);
  }

  // ── Attachments ───────────────────────────────────────────────────

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file', { storage: storage(), limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadAttachment(
    @Param('id') ticketId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('commentId') commentId: string | undefined,
    @Request() req: any,
  ) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) throw new Error('تیکت پیدا نشد');

    const attachment = await this.prisma.ticketAttachment.create({
      data: {
        ticketId,
        commentId: commentId || null,
        uploadedById: req.user.id,
        url: `/uploads/tickets/${file.filename}`,
        name: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      },
    });

    await this.prisma.ticketEvent.create({
      data: { ticketId, actorId: req.user.id, type: 'ATTACHMENT_ADDED', meta: { name: file.originalname } },
    });

    return attachment;
  }

  // ── Dept Configs ──────────────────────────────────────────────────

  @Get('config/all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getAllConfigs() {
    return this.categories.getAllConfigs();
  }

  @Get('config/enabled')
  getEnabledConfigs() {
    return this.categories.getEnabledConfigs();
  }

  @Get('config/:departmentId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  getConfig(@Param('departmentId') departmentId: string) {
    return this.categories.getConfig(departmentId);
  }

  @Post('config')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  upsertConfig(@Body() dto: UpsertDeptConfigDto) {
    return this.categories.upsertConfig(dto);
  }

  // ── Categories ────────────────────────────────────────────────────

  @Get('categories/by-dept/:departmentId')
  getCategoriesByDept(@Param('departmentId') departmentId: string) {
    return this.categories.getCategoriesByDept(departmentId);
  }

  @Get('categories/by-config/:configId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  getCategoriesByConfig(@Param('configId') configId: string) {
    return this.categories.getCategoriesByConfig(configId);
  }

  @Post('categories')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categories.createCategory(dto);
  }

  @Patch('categories/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  deleteCategory(@Param('id') id: string) {
    return this.categories.deleteCategory(id);
  }

  // ── Settings ──────────────────────────────────────────────────────

  @Get('settings/global')
  getSettings() {
    return this.categories.getSettings();
  }

  @Patch('settings/global')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateSettings(@Body() dto: UpdateTicketSettingsDto, @Request() req: any) {
    return this.categories.updateSettings(dto, req.user.id);
  }

  // ── Analytics ─────────────────────────────────────────────────────

  @Get('analytics/dashboard')
  @UseGuards(PagePermissionGuard)
  @Page('/dashboard/tickets/dashboard')
  getDashboard(@Query() q: any) {
    return this.analytics.getDashboardStats(q);
  }

  @Get('analytics/workload')
  @UseGuards(PagePermissionGuard)
  @Page('/dashboard/tickets/dashboard')
  getWorkload(@Query() q: any) {
    return this.analytics.getWorkloadReport(q);
  }

  @Get('analytics/sla')
  @UseGuards(PagePermissionGuard)
  @Page('/dashboard/tickets/dashboard')
  getSla(@Query() q: any) {
    return this.analytics.getSlaReport(q);
  }
}
