import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { generateCode128Png, generateQrPng } from './barcode.util';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assets/report')
export class AssetsReportController {
  constructor(private prisma: PrismaService) {}

  @Get('pdf')
  @Roles('ADMIN', 'MANAGER')
  async pdf(@Query('type') type: 'QR' | 'CODE128' = 'QR', @Res() res: Response) {
  const items = await this.prisma.asset.findMany({ orderBy: { createdAt: 'desc' }, take: 1000, select: { id: true, name: true, description: true, barcode: true } as any });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="assets.pdf"');

    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    doc.pipe(res);

    const perPage = 10;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rowHeight = 72;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (i > 0 && i % perPage === 0) doc.addPage();
      const y = doc.page.margins.top + (i % perPage) * rowHeight;

  doc.fontSize(12).text(`${item.name} (${(item as any).barcode})`, doc.page.margins.left, y);
      doc.fontSize(10).fillColor('#555').text(String((item as any).description || ''), doc.page.margins.left, y + 16, { width, ellipsis: true });

  const codeText = (item as any).barcode;
      const png = type === 'QR' ? await generateQrPng(codeText) : await generateCode128Png(codeText);
      doc.image(png, doc.page.width - doc.page.margins.right - 120, y, { width: 100 });
      doc.rect(doc.page.margins.left, y, width, rowHeight).stroke('#ddd');
    }

    doc.end();
  }
}
