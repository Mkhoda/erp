import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const MEMBER_SELECT = {
  userDepartments: {
    select: {
      userId: true,
      user: { select: { id: true, firstName: true, lastName: true, role: true, disabled: true } },
    },
  },
};

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  findAll() { return this.prisma.department.findMany({ include: MEMBER_SELECT }); }
  findOne(id: string) { return this.prisma.department.findUnique({ where: { id }, include: MEMBER_SELECT }); }
  create(data: any) { return this.prisma.department.create({ data }); }
  update(id: string, data: any) { return this.prisma.department.update({ where: { id }, data }); }
  remove(id: string) { return this.prisma.department.delete({ where: { id } }); }

  async addMember(departmentId: string, userId: string) {
    await this.prisma.userDepartment.upsert({
      where: { userId_departmentId: { userId, departmentId } },
      update: {},
      create: { userId, departmentId },
    });
    return this.findOne(departmentId);
  }

  async removeMember(departmentId: string, userId: string) {
    await this.prisma.userDepartment.deleteMany({ where: { userId, departmentId } });
    return this.findOne(departmentId);
  }
}
