import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TodosService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.todo.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(userId: string, title: string) {
    return this.prisma.todo.create({ data: { userId, title } });
  }

  async toggle(id: string, userId: string) {
    const todo = await this.prisma.todo.findFirst({ where: { id, userId } });
    if (!todo) return null;
    return this.prisma.todo.update({ where: { id }, data: { done: !todo.done } });
  }

  remove(id: string, userId: string) {
    return this.prisma.todo.deleteMany({ where: { id, userId } });
  }
}
