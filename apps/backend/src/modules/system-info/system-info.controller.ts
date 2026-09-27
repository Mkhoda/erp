import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SystemInfoService } from './system-info.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('system-info')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SystemInfoController {
  constructor(private readonly svc: SystemInfoService) {}

  @Get('version')
  version() {
    return this.svc.getVersion();
  }

  @Get('commits')
  commits(@Query('limit') limit?: string) {
    return this.svc.getCommits(limit ? +limit : undefined);
  }
}
