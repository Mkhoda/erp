import { Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as sharpModule from 'sharp';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const uploadRoot = path.join(process.cwd(), 'uploads', 'assets');
fs.mkdirSync(uploadRoot, { recursive: true });

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('uploads')
export class UploadController {
  @Post('asset-image')
  @Roles('ADMIN', 'MANAGER')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: uploadRoot,
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        cb(null, name);
      }
    })
  }))
  async upload(@UploadedFile() file: Express.Multer.File) {
    const target = path.join(uploadRoot, file.filename);
    const out = path.join(uploadRoot, `c-${file.filename}`);
  const sharp: any = (sharpModule as any).default ?? (sharpModule as any);
  await sharp(target).resize(1200, 1200, { fit: 'inside' }).jpeg({ quality: 80 }).toFile(out);
    try { fs.unlinkSync(target); } catch {}
    const url = `/uploads/assets/${path.basename(out)}`;
    return { url };
  }
}
