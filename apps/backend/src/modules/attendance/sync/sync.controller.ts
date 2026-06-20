import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Page } from '../../permissions/page.decorator';
import { SyncService } from './sync.service';

// Sync monitor + manual trigger — admin only.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Page('/dashboard/attendance/sync')
@Controller('attendance/sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('run')
  run(@Body('sourceId') sourceId: string) {
    return this.sync.runSource(sourceId, 'manual');
  }

  @Get('status')
  status() {
    return this.sync.getStatus();
  }

  @Get('logs')
  logs(@Query('sourceId') sourceId?: string, @Query('take') take?: string) {
    return this.sync.getLogs(sourceId, take ? Math.min(parseInt(take, 10) || 50, 200) : 50);
  }
}
