import { Body, Controller, Delete, Get, Param, Patch, Post, UseFilters, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PageAccess, PageAccessGuard } from '../permissions/page-access.guard';
import { AssetCategoriesService } from './categories.service';
import { AssetsPrismaErrorFilter } from './prisma-error.filter';

@UseGuards(JwtAuthGuard, PageAccessGuard)
@PageAccess({ pages: ['/dashboard/assets/categories'], readAlso: ['/dashboard/assets'] })
@UseFilters(AssetsPrismaErrorFilter)
@Controller('asset-categories')
export class AssetCategoriesController {
  constructor(private readonly service: AssetCategoriesService) {}

  @Get()
  list() { return this.service.list(); }

  @Post()
  create(@Body() data: any) { return this.service.create(data); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) { return this.service.update(id, data); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
