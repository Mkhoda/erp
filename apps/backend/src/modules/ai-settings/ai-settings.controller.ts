import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AiSettingsService } from './ai-settings.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('ai-settings')
export class AiSettingsController {
  constructor(private readonly service: AiSettingsService) {}

  /** List all configured AI providers (API keys are masked). */
  @Get('providers')
  listProviders() {
    return this.service.listAll();
  }

  /** Get a single provider by ID. */
  @Get('providers/:id')
  getProvider(@Param('id') id: string) {
    return this.service.getById(id);
  }

  /** Create or update a provider (upsert by type). */
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

  /** Delete a provider by type. */
  @Delete('providers/:type')
  removeProvider(@Param('type') type: string) {
    return this.service.remove(type);
  }

  /** Test connection to a provider's API. */
  @Post('providers/:type/test')
  testConnection(@Param('type') type: string) {
    return this.service.testConnection(type);
  }

  /** Get usage statistics for all providers. */
  @Get('usage')
  getUsage(
    @Query('userId') userId?: string,
    @Query('providerType') providerType?: string,
    @Query('days') days?: string,
  ) {
    return this.service.getUsage(userId, providerType, days ? parseInt(days) : 30);
  }

  /** Get per-user usage breakdown. */
  @Get('usage/users')
  getUserUsageBreakdown(@Query('days') days?: string) {
    return this.service.getUserUsageBreakdown(days ? parseInt(days) : 30);
  }
}
