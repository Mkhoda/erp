import { BadRequestException, Body, Controller, Logger, Post, UploadedFile, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as sharpModule from 'sharp';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PageAccess, PageAccessGuard } from '../permissions/page-access.guard';
import { AssetsService } from './assets.service';
import { AssetsPrismaErrorFilter } from './prisma-error.filter';

const uploadRoot = path.join(process.cwd(), 'uploads', 'assets');
fs.mkdirSync(uploadRoot, { recursive: true });

// Formats a browser can display as-is if sharp can't process the file.
const DISPLAYABLE = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

@UseGuards(JwtAuthGuard, PageAccessGuard)
@PageAccess({ pages: ['/dashboard/assets'] })
@UseFilters(AssetsPrismaErrorFilter)
@Controller('uploads')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly assets: AssetsService) {}

  /**
   * Stores an asset image on the server's local disk (uploads/assets), resized to
   * max 1200px JPEG. When `assetId` is sent the image is also attached to that
   * asset right away; otherwise the caller keeps the returned url and sends it in
   * the asset's `images` list.
   */
  @Post('asset-image')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: uploadRoot,
      filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
      },
    }),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
      if (!file.mimetype.startsWith('image/') || file.mimetype === 'image/svg+xml') {
        return cb(new BadRequestException('فقط فایل تصویری (JPG, PNG, WEBP, …) مجاز است'), false);
      }
      cb(null, true);
    },
  }))
  async upload(@UploadedFile() file: Express.Multer.File, @Body('assetId') assetId?: string) {
    if (!file) throw new BadRequestException('فایلی ارسال نشد');
    const source = path.join(uploadRoot, file.filename);
    let finalName = `c-${path.parse(file.filename).name}.jpg`;
    try {
      const sharp: any = (sharpModule as any).default ?? (sharpModule as any);
      // rotate() applies EXIF orientation so phone photos aren't sideways
      await sharp(source).rotate().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 }).toFile(path.join(uploadRoot, finalName));
      try { fs.unlinkSync(source); } catch {}
    } catch (err: any) {
      // e.g. HEIC or a sharp/libvips problem on the server — keep the original if the browser can show it
      this.logger.warn(`sharp failed for ${file.originalname}: ${err?.message ?? err}`);
      if (!DISPLAYABLE.has(path.extname(file.filename).toLowerCase())) {
        try { fs.unlinkSync(source); } catch {}
        throw new BadRequestException('این فرمت تصویر پشتیبانی نمی‌شود؛ لطفاً JPG یا PNG ارسال کنید');
      }
      finalName = file.filename;
    }

    const url = `/uploads/assets/${finalName}`;
    const image = assetId ? await this.assets.addImage(assetId, url) : undefined;
    return { url, image };
  }
}
