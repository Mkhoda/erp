import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AssetCategoriesService } from './categories.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('asset-categories')
export class AssetCategoriesController {
  constructor(private readonly service: AssetCategoriesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  list() { return this.service.list(); }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body() data: any) { return this.service.create(data); }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() data: any) { return this.service.update(id, data); }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
