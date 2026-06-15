import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TodosService } from './todos.service';

@UseGuards(JwtAuthGuard)
@Controller('todos')
export class TodosController {
  constructor(private service: TodosService) {}

  @Get()
  list(@Req() req: any) {
    return this.service.list(req.user.userId ?? req.user.id);
  }

  @Post()
  create(@Req() req: any, @Body() body: { title: string }) {
    return this.service.create(req.user.userId ?? req.user.id, body.title);
  }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string, @Req() req: any) {
    return this.service.toggle(id, req.user.userId ?? req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.userId ?? req.user.id);
  }
}
