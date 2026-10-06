import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseFilters, UseGuards, Req } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PageAccess, PageAccessGuard } from '../permissions/page-access.guard';
import { Response } from 'express';
import { generateQrPng, generateCode128Png } from './barcode.util';
import { ConfigService } from '@nestjs/config';
import { AssetsPrismaErrorFilter } from './prisma-error.filter';

@UseGuards(JwtAuthGuard, PageAccessGuard)
@PageAccess({ pages: ['/dashboard/assets'], readAlso: ['/dashboard/reports'] })
@UseFilters(AssetsPrismaErrorFilter)
@Controller('assets')
export class AssetsController {
  constructor(private readonly service: AssetsService, private config: ConfigService) {}

  @Get()
  list(@Query() query: any) { return this.service.list(query); }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.get(id); }

  @Post()
  create(@Body() data: any, @Req() req: any) { return this.service.create({ ...data, createdById: req?.user?.id }); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) { return this.service.update(id, data); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  /** Attach an already-uploaded image (see POST /uploads/asset-image) to the asset. */
  @Post(':id/images')
  addImage(@Param('id') id: string, @Body() body: { url?: string; caption?: string }) {
    if (!body?.url || !body.url.startsWith('/uploads/assets/')) throw new BadRequestException('آدرس تصویر نامعتبر است');
    return this.service.addImage(id, body.url, body.caption);
  }

  @Delete(':id/images/:imageId')
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) { return this.service.removeImage(id, imageId); }

  @Get(':id/qr.png')
  async qr(@Param('id') id: string, @Res() res: Response) {
    await this.service.get(id);
    const appUrl = this.config.get<string>('APP_URL') || 'http://localhost:3000';
    const url = `${appUrl}/dashboard/assets/${id}`;
    const png = await generateQrPng(url);
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  }

  @Get(':id/barcode.png')
  async barcode(@Param('id') id: string, @Res() res: Response) {
    const item = await this.service.get(id);
    const png = await generateCode128Png(item.barcode || id);
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  }
}
