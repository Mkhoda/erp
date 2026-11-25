import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { ChatFilesService } from './files.service';

const uid = (req: any) => req.user?.sub || req.user?.userId || req.user?.id;

@Controller('chat-history/files')
export class ChatFilesController {
  constructor(private readonly files: ChatFilesService) {}

  /** What may be uploaded (the page builds its file picker and limits from this). */
  @Get('policy')
  @UseGuards(JwtAuthGuard)
  policy() { return this.files.policyView(); }

  @Patch('policy')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  savePolicy(@Body() body: any) { return this.files.savePolicy(body); }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 101 * 1024 * 1024, files: 1 } }))
  upload(@Req() req: any, @UploadedFile() file: Express.Multer.File) { return this.files.upload(uid(req), file); }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: any, @Param('id') id: string) { return this.files.remove(uid(req), id); }

  /** Signed link (minted for the owner when a message is loaded) — no bearer token, so <img>/<video> can use it. */
  @Get(':id')
  serve(@Param('id') id: string, @Query() q: any, @Res() res: any) { return this.files.serve(id, q, res); }
}
