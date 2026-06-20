import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Page } from '../../permissions/page.decorator';
import { SourcesService } from './sources.service';
import { UpsertDeviceDto, UpsertSourceDto } from '../dto/source.dto';

// Attendance integration settings — admin only.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Page('/dashboard/attendance/settings')
@Controller('attendance/sources')
export class SourcesController {
  constructor(private readonly sources: SourcesService) {}

  @Get()
  findAll() {
    return this.sources.findAll();
  }

  @Post()
  create(@Body() dto: UpsertSourceDto) {
    return this.sources.create(dto);
  }

  // Validate + test an unsaved configuration (form "Test Connection" button).
  @Post('validate')
  validate(@Body() dto: UpsertSourceDto) {
    return this.sources.validateAndTest(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sources.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertSourceDto) {
    return this.sources.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sources.remove(id);
  }

  // Test a saved source using its stored credentials.
  @Post(':id/test')
  test(@Param('id') id: string) {
    return this.sources.test(id);
  }

  // ── Device mapping ──
  @Get(':id/devices')
  listDevices(@Param('id') id: string) {
    return this.sources.listDevices(id);
  }

  // Create or update a device mapping (upsert keyed on deviceCode).
  @Post(':id/devices')
  upsertDevice(@Param('id') id: string, @Body() dto: UpsertDeviceDto) {
    return this.sources.upsertDevice(id, dto);
  }

  @Delete('devices/:deviceId')
  removeDevice(@Param('deviceId') deviceId: string) {
    return this.sources.removeDevice(deviceId);
  }
}
