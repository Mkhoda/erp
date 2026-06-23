import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Page } from '../../permissions/page.decorator';
import { HolidaysService } from './holidays.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Page('/dashboard/attendance/holidays')
@Controller('attendance/holidays')
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get()
  list() {
    return this.holidays.list();
  }

  @Post()
  create(@Body() body: any) {
    return this.holidays.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.holidays.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.holidays.remove(id);
  }
}
