import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AiSettingsService } from './ai-settings.service';

@UseGuards(JwtAuthGuard)
@Controller('ai-settings')
export class AiSettingsController {
  constructor(private readonly service: AiSettingsService) {}

  /** Active providers for end-users (no API keys). */
  @Get('providers/active')
  getActiveProviders() {
    return this.service.getActiveProviders();
  }

  /** Transcribe audio file to text via Whisper (any authenticated user). */
  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio_file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  transcribe(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Query('language') language = 'fa',
  ) {
    const userId = req.user?.sub || req.user?.userId || req.user?.id;
    return this.service.transcribe(userId, file, language);
  }

  /** Chat with selected provider by ID (any authenticated user). */
  @Post('chat')
  chat(
    @Req() req: any,
    @Body() body: { providerId: string; messages: Array<{ role: string; content: string }>; safeMode?: boolean },
  ) {
    const userId = req.user?.sub || req.user?.userId || req.user?.id;
    return this.service.chat(userId, body.providerId, body.messages, body.safeMode ?? false);
  }

  /** List all configured providers (API keys masked). ADMIN only. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('providers')
  listProviders() {
    return this.service.listAll();
  }

  /** Get a single provider by ID. ADMIN only. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('providers/:id')
  getProvider(@Param('id') id: string) {
    return this.service.getById(id);
  }

  /** Create a new provider. ADMIN only. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post('providers')
  createProvider(@Body() body: {
    name: string; type: string; apiKey: string;
    apiUrl?: string; model?: string; isActive?: boolean; config?: Record<string, any>;
  }) {
    return this.service.create(body);
  }

  /** Update an existing provider by ID. ADMIN only. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Put('providers/:id')
  updateProvider(
    @Param('id') id: string,
    @Body() body: { name?: string; type?: string; apiKey?: string; apiUrl?: string; model?: string; isActive?: boolean; config?: Record<string, any> },
  ) {
    return this.service.update(id, body);
  }

  /** Toggle isActive for a provider. ADMIN only. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch('providers/:id/toggle')
  toggleProvider(@Param('id') id: string) {
    return this.service.toggleProvider(id);
  }

  /** Delete a provider by ID. ADMIN only. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete('providers/:id')
  removeProvider(@Param('id') id: string) {
    return this.service.remove(id);
  }

  /** Test connection to a provider. ADMIN only. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post('providers/:id/test')
  testConnection(@Param('id') id: string) {
    return this.service.testConnection(id);
  }

  /** Usage statistics. ADMIN only. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('usage')
  getUsage(@Query('userId') userId?: string, @Query('providerType') providerType?: string, @Query('days') days?: string) {
    return this.service.getUsage(userId, providerType, days ? parseInt(days) : 30);
  }

  /** Per-user usage breakdown. ADMIN only. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('usage/users')
  getUserUsageBreakdown(@Query('days') days?: string) {
    return this.service.getUserUsageBreakdown(days ? parseInt(days) : 30);
  }
}
