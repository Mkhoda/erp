import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RecomputeService } from '../attendance/engine/recompute.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private recompute: RecomputeService,
  ) {}

  findAll(currentUser?: { role: string; userId?: string; departmentId?: string }) {
    const where = (currentUser && currentUser.role === 'MANAGER')
      ? { departmentId: currentUser.departmentId ?? undefined }
      : undefined;
    return this.prisma.user.findMany({
      where,
      select: { id: true, email: true, phone: true, firstName: true, lastName: true, role: true, departmentId: true, department: true, disabled: true, attendanceCardNo: true, userDepartments: { select: { departmentId: true, department: true } } },
    });
  }
  findOne(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, phone: true, firstName: true, lastName: true, role: true, departmentId: true, department: true, disabled: true, attendanceCardNo: true, userDepartments: { select: { departmentId: true, department: true } } } });
  }
  async create(data: any) {
    const payload = { ...data };
    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 10);
    }
    // Normalize email — empty string becomes null
    if (!payload.email || payload.email.trim() === '') payload.email = null;
    else payload.email = payload.email.trim().toLowerCase();
    // Normalize phone
    if (!payload.phone || payload.phone.trim() === '') payload.phone = null;
    // Normalize attendance card number — empty becomes null (column is @unique)
    if ('attendanceCardNo' in payload) {
      payload.attendanceCardNo = payload.attendanceCardNo && String(payload.attendanceCardNo).trim() !== ''
        ? String(payload.attendanceCardNo).trim() : null;
    }
    const departmentIds: string[] | undefined = Array.isArray(payload.departmentIds) ? payload.departmentIds : undefined;
    delete payload.departmentIds;
    const created = await this.prisma.user.create({ data: payload, select: { id: true, email: true, firstName: true, lastName: true, role: true, departmentId: true } });
    if (departmentIds?.length) {
      await this.prisma.userDepartment.createMany({ data: departmentIds.map((d) => ({ userId: created.id, departmentId: d })) });
    }
    // Auto-link + recompute attendance when a card number was set.
    if (payload.attendanceCardNo) await this.linkAttendance(created.id);
    return created;
  }

  // Best-effort: never let attendance recompute break a user save.
  private async linkAttendance(userId: string) {
    try {
      await this.recompute.relinkUser(userId);
    } catch {
      /* ignore — admin can re-run «اتصال و بازمحاسبه» from the dashboard */
    }
  }
  
  // Bulk create users: accepts array of user-like objects.
  // For MANAGER role, restrict created users' department to manager's departmentId if not provided.
  async bulkCreate(rows: any[], currentUser?: { role: string; userId?: string; departmentId?: string }) {
    // Transactional: all-or-nothing bulk import
    if (!Array.isArray(rows) || rows.length === 0) {
      return { imported: 0, errors: [] };
    }

    // Preprocess rows: prepare payloads and hash passwords
    const payloads = await Promise.all(rows.map(async (row: any, idx: number) => {
      const payload: any = { ...row };
      if (currentUser && currentUser.role === 'MANAGER') {
        if (!payload.departmentId) payload.departmentId = currentUser.departmentId;
      }
      if (payload.password) payload.password = await bcrypt.hash(payload.password, 10);
      const departmentIds: string[] | undefined = Array.isArray(payload.departmentIds) ? payload.departmentIds : (payload.departmentId ? [payload.departmentId] : undefined);
      delete payload.departmentIds;
      return { payload, departmentIds, original: row };
    }));

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const createdUsers: any[] = [];
        for (let i = 0; i < payloads.length; i++) {
          const { payload, departmentIds } = payloads[i];
          const created = await tx.user.create({ data: payload, select: { id: true, email: true, firstName: true, lastName: true, role: true, departmentId: true } });
          if (departmentIds && departmentIds.length) {
            const data = departmentIds.map((d) => ({ userId: created.id, departmentId: d }));
            await tx.userDepartment.createMany({ data, skipDuplicates: true });
          }
          createdUsers.push(created);
        }
        return { imported: createdUsers.length };
      });
      return { imported: result.imported, errors: [] };
    } catch (err: any) {
      // Transaction failed: return error info without partial inserts
      return { imported: 0, errors: [{ row: 0, message: err?.message || String(err) }] };
    }
  }
  async update(id: string, data: any) {
    const payload = { ...data };
    // Hash password if provided (for create or password reset)
    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 10);
    } else {
      delete payload.password;
    }
    // Normalize email
    if ('email' in payload) {
      if (!payload.email || payload.email.trim() === '') payload.email = null;
      else payload.email = payload.email.trim().toLowerCase();
    }
    // Normalize phone
    if ('phone' in payload && (!payload.phone || payload.phone.trim() === '')) {
      payload.phone = null;
    }
    // Normalize attendance card number — empty becomes null (column is @unique)
    if ('attendanceCardNo' in payload) {
      payload.attendanceCardNo = payload.attendanceCardNo && String(payload.attendanceCardNo).trim() !== ''
        ? String(payload.attendanceCardNo).trim() : null;
    }
    const departmentIds: string[] | undefined = Array.isArray(payload.departmentIds) ? payload.departmentIds : undefined;
    delete payload.departmentIds;
    const updated = await this.prisma.user.update({ where: { id }, data: payload, select: { id: true, email: true, phone: true, firstName: true, lastName: true, role: true, departmentId: true, disabled: true, attendanceCardNo: true } });
    if (departmentIds) {
      // reset memberships
      await this.prisma.userDepartment.deleteMany({ where: { userId: id } });
      if (departmentIds.length) {
        await this.prisma.userDepartment.createMany({ data: departmentIds.map((d) => ({ userId: id, departmentId: d })) });
      }
    }
    // Auto-link + recompute attendance when a card number was set/changed.
    if ('attendanceCardNo' in payload && payload.attendanceCardNo) await this.linkAttendance(id);
    return updated;
  }
  remove(id: string) { return this.prisma.user.delete({ where: { id } }); }
}
