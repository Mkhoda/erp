import { Controller, Delete, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('request-logs')
export class RequestLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('method') method?: string,
    @Query('path') path?: string,
    @Query('statusCode') statusCode?: string,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const since = new Date(Date.now() - (parseInt(days || '1') * 24 * 60 * 60 * 1000));
    return this.prisma.requestLog.findMany({
      where: {
        createdAt: { gte: since },
        ...(method ? { method: method.toUpperCase() } : {}),
        ...(path ? { path: { contains: path } } : {}),
        ...(statusCode ? { statusCode: parseInt(statusCode) } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit || '200'), 500),
    });
  }

  @Get('stats')
  async stats(@Query('days') days?: string) {
    const since = new Date(Date.now() - (parseInt(days || '1') * 24 * 60 * 60 * 1000));
    const [total, errors, slow] = await Promise.all([
      this.prisma.requestLog.count({ where: { createdAt: { gte: since } } }),
      this.prisma.requestLog.count({ where: { createdAt: { gte: since }, statusCode: { gte: 400 } } }),
      this.prisma.requestLog.count({ where: { createdAt: { gte: since }, latencyMs: { gte: 2000 } } }),
    ]);
    const errorPaths = await this.prisma.requestLog.groupBy({
      by: ['path', 'method'],
      where: { createdAt: { gte: since }, statusCode: { gte: 400 } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    return { total, errors, slow, errorRate: total > 0 ? Math.round((errors / total) * 100) : 0, errorPaths };
  }

  @Delete('clear')
  async clearOld(@Query('days') days?: string) {
    const before = new Date(Date.now() - (parseInt(days || '7') * 24 * 60 * 60 * 1000));
    const { count } = await this.prisma.requestLog.deleteMany({ where: { createdAt: { lt: before } } });
    return { deleted: count };
  }
}
