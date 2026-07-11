import {
  Controller, Delete, Get, Param, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get('stats')
  stats() {
    return this.sessions.stats();
  }

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('includeRevoked') includeRevoked?: string,
    @Query('onlineOnly') onlineOnly?: string,
  ) {
    return this.sessions.list({
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      userId: userId || undefined,
      includeRevoked: includeRevoked === 'true',
      onlineOnly: onlineOnly === 'true',
    });
  }

  @Delete(':id')
  revoke(@Param('id') id: string, @Req() req: any) {
    return this.sessions.revokeSession(id, req.user.userId);
  }

  @Post('revoke-all')
  revokeAll(@Req() req: any) {
    return this.sessions.revokeAll(req.user.userId);
  }

  @Post('purge-expired')
  purgeExpired(@Query('days') days?: string) {
    return this.sessions.purgeExpired(days ? +days : 30);
  }
}
