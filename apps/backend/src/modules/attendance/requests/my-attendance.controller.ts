import { BadRequestException, Body, Controller, Get, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RecordsService } from '../records/records.service';
import { RequestsService } from './requests.service';
import { toJalaliParts, workDateOf } from '../engine/jalali.util';
import { parseWorkDate } from '../scope.util';

const uploadRoot = path.join(process.cwd(), 'uploads', 'attendance');
fs.mkdirSync(uploadRoot, { recursive: true });

// Employee self-service — every authenticated user sees only their own data.
@UseGuards(JwtAuthGuard)
@Controller('attendance/me')
export class MyAttendanceController {
  constructor(
    private readonly records: RecordsService,
    private readonly requests: RequestsService,
  ) {}

  private uid(req: any): string {
    return req.user?.userId ?? req.user?.id;
  }

  @Get('days')
  days(@Req() req: any, @Query() q: any) {
    return this.records.list({
      userId: this.uid(req),
      jYear: q.jYear ? +q.jYear : undefined,
      jMonth: q.jMonth ? +q.jMonth : undefined,
      jDay: q.jDay ? +q.jDay : undefined,
      status: q.status || undefined,
    });
  }

  @Get('summary')
  summary(@Req() req: any, @Query() q: any) {
    return this.records.summary({
      userId: this.uid(req),
      jYear: q.jYear ? +q.jYear : undefined,
      jMonth: q.jMonth ? +q.jMonth : undefined,
      jDay: q.jDay ? +q.jDay : undefined,
    });
  }

  @Get('periods')
  periods(@Req() req: any) {
    return this.records.periods({ userId: this.uid(req) });
  }

  @Get('day')
  day(@Req() req: any, @Query('date') date: string) {
    return this.records.dayDetail(this.uid(req), parseWorkDate(date));
  }

  @Get('leave-balance')
  leaveBalance(@Req() req: any, @Query('jYear') jYear?: string) {
    const now = toJalaliParts(workDateOf(new Date()));
    return this.records.leaveBalance(this.uid(req), jYear ? +jYear : now.jYear);
  }

  @Get('requests')
  myRequests(@Req() req: any) {
    return this.requests.listForUser(this.uid(req));
  }

  @Post('requests')
  create(@Req() req: any, @Body() body: any) {
    return this.requests.create(this.uid(req), body);
  }

  // Doctor's-note (or similar) image for a sick-leave request. Uploaded first,
  // separately from create() (which stays a plain JSON POST) — the returned
  // url is then passed back as `attachment` in the request body.
  @Post('requests/attachment')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: uploadRoot,
      filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
      if (!file.mimetype.startsWith('image/')) return cb(new BadRequestException('فقط فایل تصویری مجاز است'), false);
      cb(null, true);
    },
  }))
  uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('فایلی ارسال نشد');
    return { url: `/uploads/attendance/${file.filename}` };
  }
}
