import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AiSettingsService } from './ai-settings.service';

@UseGuards(JwtAuthGuard)
@Controller('ai-settings')
export class AiSettingsController {
  constructor(private readonly service: AiSettingsService) {}

  /** Active providers for end-users (no API keys, any authenticated user). */
  @Get('providers/active')
  getActiveProviders() {
    return this.service.getActiveProviders();
  }

  /** Chat with selected provider (any authenticated user). */
  @Post('chat')
  chat(
    @Req() req: any,
    @Body() body: { providerType: string; messages: Array<{ role: string; content: string }>; safeMode?: boolean },
  ) {
    const userId = req.user?.sub || req.user?.userId || req.user?.id;
    return this.service.chat(userId, body.providerType, body.messages, body.safeMode ?? false);
  }

  /** List all configured AI providers (API keys are masked). ADMIN only. */
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

  /** Create or update a provider (upsert by type). ADMIN only. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Put('providers')
  upsertProvider(@Body() body: {
    name: string;
    type: string;
    apiKey: string;
    apiUrl?: string;
    model?: string;
    isActive?: boolean;
    config?: Record<string, any>;
  }) {
    return this.service.upsert(body);
  }

  /** Toggle isActive for a provider. ADMIN only. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch('providers/:type/toggle')
  toggleProvider(@Param('type') type: string) {
    return this.service.toggleProvider(type);
  }

  /** Delete a provider by type. ADMIN only. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete('providers/:type')
  removeProvider(@Param('type') type: string) {
    return this.service.remove(type);
  }

  /** Test connection to a provider's API. ADMIN only. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post('providers/:type/test')
  testConnection(@Param('type') type: string) {
    return this.service.testConnection(type);
  }

  /** Get usage statistics for all providers. ADMIN only. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('usage')
  getUsage(
    @Query('userId') userId?: string,
    @Query('providerType') providerType?: string,
    @Query('days') days?: string,
  ) {
    return this.service.getUsage(userId, providerType, days ? parseInt(days) : 30);
  }

  /** Get per-user usage breakdown. ADMIN only. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('usage/users')
  getUserUsageBreakdown(@Query('days') days?: string) {
    return this.service.getUserUsageBreakdown(days ? parseInt(days) : 30);
  }
}
