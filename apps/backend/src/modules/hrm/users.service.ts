import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll(currentUser?: { role: string; userId?: string; departmentId?: string }) {
    const where = (currentUser && currentUser.role === 'MANAGER')
      ? { departmentId: currentUser.departmentId ?? undefined }
      : undefined;
    return this.prisma.user.findMany({
      where,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, departmentId: true, department: true, userDepartments: { select: { departmentId: true, department: true } } },
    });
  }
  findOne(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, firstName: true, lastName: true, role: true, departmentId: true, department: true, userDepartments: { select: { departmentId: true, department: true } } } });
  }
  async create(data: any) {
    const payload = { ...data };
    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 10);
    }
    const departmentIds: string[] | undefined = Array.isArray(payload.departmentIds) ? payload.departmentIds : undefined;
    delete payload.departmentIds;
    const created = await this.prisma.user.create({ data: payload, select: { id: true, email: true, firstName: true, lastName: true, role: true, departmentId: true } });
    if (departmentIds?.length) {
      await this.prisma.userDepartment.createMany({ data: departmentIds.map((d) => ({ userId: created.id, departmentId: d })) });
    }
    return created;
  }
  async update(id: string, data: any) {
    const payload = { ...data };
    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 10);
    }
    const departmentIds: string[] | undefined = Array.isArray(payload.departmentIds) ? payload.departmentIds : undefined;
    delete payload.departmentIds;
    const updated = await this.prisma.user.update({ where: { id }, data: payload, select: { id: true, email: true, firstName: true, lastName: true, role: true, departmentId: true } });
    if (departmentIds) {
      // reset memberships
      await this.prisma.userDepartment.deleteMany({ where: { userId: id } });
      if (departmentIds.length) {
        await this.prisma.userDepartment.createMany({ data: departmentIds.map((d) => ({ userId: id, departmentId: d })) });
      }
    }
    return updated;
  }
  remove(id: string) { return this.prisma.user.delete({ where: { id } }); }
}
