import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards, Req } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Response } from 'express';
import { generateQrPng, generateCode128Png } from './barcode.util';
import { ConfigService } from '@nestjs/config';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly service: AssetsService, private config: ConfigService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'EXPERT')
  list(@Query() query: any) { return this.service.list(query); }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'USER')
  get(@Param('id') id: string) { return this.service.get(id); }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body() data: any, @Req() req: any) { return this.service.create({ ...data, createdById: req?.user?.userId }); }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'EXPERT')
  update(@Param('id') id: string, @Body() data: any) { return this.service.update(id, data); }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @Get(':id/qr.png')
  @Roles('ADMIN', 'MANAGER', 'USER')
  async qr(@Param('id') id: string, @Res() res: Response) {
    const item = await this.service.get(id);
    if (!item) { res.status(404).end(); return; }
    const appUrl = this.config.get<string>('APP_URL') || 'http://localhost:3000';
    const url = `${appUrl}/dashboard/assets/${id}`;
    const png = await generateQrPng(url);
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  }

  @Get(':id/barcode.png')
  @Roles('ADMIN', 'MANAGER', 'USER')
  async barcode(@Param('id') id: string, @Res() res: Response) {
    const item = await this.service.get(id);
    if (!item) { res.status(404).end(); return; }
  const png = await generateCode128Png(item.barcode || id);
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  }
}
