import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const MEMBER_SELECT = {
  userDepartments: {
    select: {
      userId: true,
      role: true,
      user: { select: { id: true, firstName: true, lastName: true, role: true, disabled: true } },
    },
  },
};

// Position of a person inside one department (a person can hold different ones in different departments).
export const MEMBER_ROLES = ['MANAGER', 'DEPUTY', 'EXPERT', 'MEMBER'] as const;
const memberRole = (r: any) => (MEMBER_ROLES.includes(r) ? r : 'MEMBER');

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  findAll() { return this.prisma.department.findMany({ include: MEMBER_SELECT, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }); }
  findOne(id: string) { return this.prisma.department.findUnique({ where: { id }, include: MEMBER_SELECT }); }

  /** Whole org chart: every department (flat, with parentId) + members, and people in no department. */
  async tree() {
    const [departments, users] = await Promise.all([
      this.prisma.department.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          userDepartments: {
            select: { userId: true, role: true, user: { select: { id: true, firstName: true, lastName: true, role: true, disabled: true, departmentId: true, attendanceCardNo: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.user.findMany({
        where: { userDepartments: { none: {} }, departmentId: null },
        select: { id: true, firstName: true, lastName: true, role: true, disabled: true, attendanceCardNo: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
    ]);
    return {
      departments: departments.map(({ userDepartments, ...d }) => ({
        ...d,
        members: userDepartments.map((m) => ({ ...m.user, memberRole: m.role, isPrimary: m.user.departmentId === d.id })),
      })),
      unassigned: users,
    };
  }

  private async assertParent(id: string | null, parentId: string | null | undefined) {
    if (!parentId) return null;
    if (parentId === id) throw new BadRequestException('یک دپارتمان نمی‌تواند زیرمجموعه خودش باشد');
    // Walk up from the new parent — reaching `id` would create a cycle.
    let cur: string | null = parentId;
    for (let guard = 0; cur && guard < 100; guard++) {
      if (cur === id) throw new BadRequestException('این جابه‌جایی حلقه در ساختار ایجاد می‌کند');
      const row: { parentId: string | null } | null = await this.prisma.department.findUnique({ where: { id: cur }, select: { parentId: true } });
      if (!row) throw new BadRequestException('دپارتمان والد یافت نشد');
      cur = row.parentId;
    }
    return parentId;
  }

  async create(data: any) {
    const name = String(data?.name || '').trim();
    if (!name) throw new BadRequestException('نام دپارتمان الزامی است');
    return this.prisma.department.create({ data: { name, parentId: await this.assertParent(null, data?.parentId), sortOrder: Math.round(+data?.sortOrder || 0) } });
  }

  async update(id: string, data: any) {
    const patch: any = {};
    if (data?.name !== undefined) {
      const name = String(data.name).trim();
      if (!name) throw new BadRequestException('نام دپارتمان الزامی است');
      patch.name = name;
    }
    if (data?.parentId !== undefined) patch.parentId = await this.assertParent(id, data.parentId || null);
    if (data?.sortOrder !== undefined) patch.sortOrder = Math.round(+data.sortOrder || 0);
    return this.prisma.department.update({ where: { id }, data: patch });
  }

  async remove(id: string) {
    // Children move up to this department's parent instead of being orphaned at the top.
    const d = await this.prisma.department.findUnique({ where: { id }, select: { parentId: true } });
    if (!d) throw new NotFoundException('دپارتمان یافت نشد');
    await this.prisma.department.updateMany({ where: { parentId: id }, data: { parentId: d.parentId } });
    return this.prisma.department.delete({ where: { id } });
  }

  async addMember(departmentId: string, userId: string, role?: string) {
    await this.prisma.userDepartment.upsert({
      where: { userId_departmentId: { userId, departmentId } },
      update: role ? { role: memberRole(role) } : {},
      create: { userId, departmentId, role: memberRole(role) },
    });
    await this.ensurePrimary(userId);
    return this.findOne(departmentId);
  }

  async removeMember(departmentId: string, userId: string) {
    await this.prisma.userDepartment.deleteMany({ where: { userId, departmentId } });
    await this.ensurePrimary(userId, departmentId);
    return this.findOne(departmentId);
  }

  async setMemberRole(departmentId: string, userId: string, role: string) {
    await this.prisma.userDepartment.update({ where: { userId_departmentId: { userId, departmentId } }, data: { role: memberRole(role) } });
    return { ok: true };
  }

  async setPrimary(departmentId: string, userId: string) {
    await this.addMember(departmentId, userId);
    await this.prisma.user.update({ where: { id: userId }, data: { departmentId } });
    return { ok: true };
  }

  /**
   * Drag-and-drop: move a person from one department to another (mode "move"), or add them to
   * the target while keeping their other memberships (mode "copy"). Moving out of the primary
   * department makes the target primary.
   */
  async moveMember(dto: { userId: string; fromDepartmentId?: string | null; toDepartmentId: string; mode?: 'move' | 'copy'; role?: string }) {
    if (!dto?.userId || !dto?.toDepartmentId) throw new BadRequestException('کاربر و دپارتمان مقصد را مشخص کنید');
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { departmentId: true } });
    if (!user) throw new NotFoundException('کاربر یافت نشد');
    const from = dto.fromDepartmentId || null;
    const prevRole = from
      ? (await this.prisma.userDepartment.findUnique({ where: { userId_departmentId: { userId: dto.userId, departmentId: from } } }))?.role
      : undefined;
    await this.prisma.$transaction(async (tx) => {
      await tx.userDepartment.upsert({
        where: { userId_departmentId: { userId: dto.userId, departmentId: dto.toDepartmentId } },
        update: {},
        create: { userId: dto.userId, departmentId: dto.toDepartmentId, role: memberRole(dto.role ?? prevRole) },
      });
      if (dto.mode !== 'copy' && from && from !== dto.toDepartmentId) {
        await tx.userDepartment.deleteMany({ where: { userId: dto.userId, departmentId: from } });
        if (user.departmentId === from) await tx.user.update({ where: { id: dto.userId }, data: { departmentId: dto.toDepartmentId } });
      }
    });
    await this.ensurePrimary(dto.userId);
    return { ok: true };
  }

  /** Keep User.departmentId pointing at one of the person's memberships (or null when none). */
  private async ensurePrimary(userId: string, removedDepartmentId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
    if (!user) return;
    const memberships = await this.prisma.userDepartment.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { departmentId: true } });
    const ids = memberships.map((m) => m.departmentId);
    if (user.departmentId && ids.includes(user.departmentId)) return;
    if (!user.departmentId && !removedDepartmentId && !ids.length) return;
    await this.prisma.user.update({ where: { id: userId }, data: { departmentId: ids[0] ?? null } });
  }
}
