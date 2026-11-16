import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RecomputeService } from '../attendance/engine/recompute.service';

// Friendly Persian names for unique fields (used in duplicate-value errors).
const FIELD_FA: Record<string, string> = {
  phone: 'شماره موبایل',
  email: 'ایمیل',
  attendanceCardNo: 'کد کارت',
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private recompute: RecomputeService,
  ) {}

  // Resolve the department ids a manager belongs to, merging the legacy single
  // FK (User.departmentId) with the many-to-many UserDepartment memberships —
  // the JWT payload never carries departmentId, so this must hit the DB.
  private async resolveManagerDeptIds(currentUser?: { userId?: string; id?: string }): Promise<string[]> {
    const uid = currentUser?.userId ?? currentUser?.id;
    if (!uid) return [];
    const [dbUser, memberships] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: uid }, select: { departmentId: true } }),
      this.prisma.userDepartment.findMany({ where: { userId: uid }, select: { departmentId: true } }),
    ]);
    const ids = new Set<string>(memberships.map((m) => m.departmentId));
    if (dbUser?.departmentId) ids.add(dbUser.departmentId);
    return Array.from(ids);
  }

  async findAll(currentUser?: { role: string; userId?: string; id?: string; departmentId?: string }) {
    let where: any = undefined;
    if (currentUser && currentUser.role === 'MANAGER') {
      const deptIds = await this.resolveManagerDeptIds(currentUser);
      where = deptIds.length
        ? { OR: [{ departmentId: { in: deptIds } }, { userDepartments: { some: { departmentId: { in: deptIds } } } }] }
        : { id: { in: [] } };
    }
    return this.prisma.user.findMany({
      where,
      select: { id: true, email: true, phone: true, firstName: true, lastName: true, role: true, departmentId: true, department: true, disabled: true, maxSessions: true, attendanceCardNo: true, userDepartments: { select: { departmentId: true, department: true } } },
    });
  }
  findOne(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, phone: true, firstName: true, lastName: true, role: true, departmentId: true, department: true, disabled: true, maxSessions: true, attendanceCardNo: true, userDepartments: { select: { departmentId: true, department: true } } } });
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
    // Release the card from any existing holder (e.g. a provision-cards
    // placeholder) — moves its punches/days aside — so the unique constraint
    // isn't violated. Safe against the AttendanceDay foreign key.
    if (payload.attendanceCardNo) {
      try { await this.recompute.freeCard(payload.attendanceCardNo); } catch { /* ignore */ }
    }
    const departmentIds: string[] | undefined = Array.isArray(payload.departmentIds) ? payload.departmentIds : undefined;
    delete payload.departmentIds;
    let created: any;
    try {
      created = await this.prisma.user.create({ data: payload, select: { id: true, email: true, firstName: true, lastName: true, role: true, departmentId: true } });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const field = e?.meta?.target?.[0] || 'فیلد';
        throw new ConflictException(`این ${FIELD_FA[field] || field} قبلاً برای کاربر دیگری ثبت شده است`);
      }
      throw e;
    }
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
  async bulkCreate(rows: any[], currentUser?: { role: string; userId?: string; id?: string; departmentId?: string }) {
    // Transactional: all-or-nothing bulk import
    if (!Array.isArray(rows) || rows.length === 0) {
      return { imported: 0, errors: [] };
    }

    const managerDeptIds = (currentUser && currentUser.role === 'MANAGER')
      ? await this.resolveManagerDeptIds(currentUser)
      : [];

    // Preprocess rows: prepare payloads and hash passwords
    const payloads = await Promise.all(rows.map(async (row: any, idx: number) => {
      const payload: any = { ...row };
      if (currentUser && currentUser.role === 'MANAGER' && !payload.departmentId) {
        payload.departmentId = managerDeptIds[0];
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
    // Assigning a card number: release it from any other holder first (the
    // provision-cards placeholder), moving its punches aside so they re-link to
    // this user. Handles the AttendanceDay foreign key safely.
    if (payload.attendanceCardNo) {
      try { await this.recompute.freeCard(payload.attendanceCardNo, id); } catch { /* ignore */ }
    }
    const departmentIds: string[] | undefined = Array.isArray(payload.departmentIds) ? payload.departmentIds : undefined;
    delete payload.departmentIds;
    let updated: any;
    try {
      updated = await this.prisma.user.update({ where: { id }, data: payload, select: { id: true, email: true, phone: true, firstName: true, lastName: true, role: true, departmentId: true, disabled: true, maxSessions: true, attendanceCardNo: true } });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const field = e?.meta?.target?.[0] || 'فیلد';
        throw new ConflictException(`این ${FIELD_FA[field] || field} قبلاً برای کاربر دیگری ثبت شده است`);
      }
      throw e;
    }
    if (departmentIds) {
      // Sync memberships without wiping the ones kept — each keeps its per-department role.
      await this.prisma.userDepartment.deleteMany({ where: { userId: id, departmentId: { notIn: departmentIds } } });
      if (departmentIds.length) {
        await this.prisma.userDepartment.createMany({ data: departmentIds.map((d) => ({ userId: id, departmentId: d })), skipDuplicates: true });
      }
    }
    // Auto-link + recompute attendance when a card number was set/changed.
    if ('attendanceCardNo' in payload && payload.attendanceCardNo) await this.linkAttendance(id);
    return updated;
  }
  remove(id: string) { return this.prisma.user.delete({ where: { id } }); }

  /**
   * Bulk actions from the users grid. ADMIN only (enforced by the controller).
   *   addDepartment / moveDepartment / removeDepartment — membership changes (move = this one only, made primary)
   *   disable / enable — sign-in on/off
   *   setRole — system role
   *   purgeCards — see purgeCards()
   */
  async bulk(actorId: string, dto: { ids: string[]; action: string; departmentId?: string; role?: string }) {
    const ids = Array.isArray(dto?.ids) ? [...new Set(dto.ids.filter(Boolean))] : [];
    if (!ids.length) throw new BadRequestException('هیچ کاربری انتخاب نشده است');
    const ROLES = ['ADMIN', 'MANAGER', 'EXPERT', 'USER'];
    switch (dto.action) {
      case 'addDepartment':
      case 'moveDepartment': {
        if (!dto.departmentId) throw new BadRequestException('دپارتمان را انتخاب کنید');
        const departmentId = dto.departmentId;
        await this.prisma.$transaction(async (tx) => {
          if (dto.action === 'moveDepartment') {
            await tx.userDepartment.deleteMany({ where: { userId: { in: ids }, departmentId: { not: departmentId } } });
            await tx.user.updateMany({ where: { id: { in: ids } }, data: { departmentId } });
          } else {
            await tx.user.updateMany({ where: { id: { in: ids }, departmentId: null }, data: { departmentId } });
          }
          await tx.userDepartment.createMany({ data: ids.map((userId) => ({ userId, departmentId })), skipDuplicates: true });
        });
        return { ok: true, count: ids.length };
      }
      case 'removeDepartment': {
        if (!dto.departmentId) throw new BadRequestException('دپارتمان را انتخاب کنید');
        await this.prisma.userDepartment.deleteMany({ where: { userId: { in: ids }, departmentId: dto.departmentId } });
        // Whoever had it as primary falls back to another membership (or none).
        const affected = await this.prisma.user.findMany({ where: { id: { in: ids }, departmentId: dto.departmentId }, select: { id: true } });
        for (const u of affected) {
          const next = await this.prisma.userDepartment.findFirst({ where: { userId: u.id }, orderBy: { createdAt: 'asc' } });
          await this.prisma.user.update({ where: { id: u.id }, data: { departmentId: next?.departmentId ?? null } });
        }
        return { ok: true, count: ids.length };
      }
      case 'disable':
      case 'enable': {
        // Never lock yourself out.
        const target = ids.filter((id) => !(dto.action === 'disable' && id === actorId));
        const r = await this.prisma.user.updateMany({ where: { id: { in: target } }, data: { disabled: dto.action === 'disable' } });
        return { ok: true, count: r.count };
      }
      case 'setRole': {
        if (!dto.role || !ROLES.includes(dto.role)) throw new BadRequestException('نقش نامعتبر است');
        const target = ids.filter((id) => id !== actorId);
        const r = await this.prisma.user.updateMany({ where: { id: { in: target } }, data: { role: dto.role as any } });
        return { ok: true, count: r.count };
      }
      case 'purgeCards':
        return this.purgeCards(actorId, ids.filter((id) => id !== actorId));
      default:
        throw new BadRequestException('عملیات نامعتبر است');
    }
  }

  /**
   * Remove people (typically auto-created "کارت <n>" placeholders) from the system for good:
   * their attendance data and raw punches go, the user row goes, and the card number lands on
   * the ignore list so sync/provisioning never brings it back into reports. A user with other
   * history (assets, tickets, messages, …) can't be deleted and is reported back instead.
   */
  async purgeCards(actorId: string, ids: string[]) {
    const deleted: string[] = [];
    const failed: Array<{ id: string; name: string; reason: string }> = [];
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, attendanceCardNo: true, role: true } });
    for (const u of users) {
      const name = `${u.firstName} ${u.lastName}`.trim();
      if (u.role === 'ADMIN') { failed.push({ id: u.id, name, reason: 'مدیر ارشد قابل حذف نیست' }); continue; }
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.attendanceDay.deleteMany({ where: { userId: u.id } });
          await tx.attendanceOverride.deleteMany({ where: { userId: u.id } });
          await tx.attendanceRequest.deleteMany({ where: { userId: u.id } });
          await tx.rawAttendanceRecord.deleteMany({ where: { OR: [{ userId: u.id }, ...(u.attendanceCardNo ? [{ cardNo: u.attendanceCardNo }] : [])] } });
          await tx.session.deleteMany({ where: { userId: u.id } });
          if (u.attendanceCardNo) {
            await tx.ignoredAttendanceCard.upsert({
              where: { cardNo: u.attendanceCardNo },
              create: { cardNo: u.attendanceCardNo, reason: name, createdById: actorId },
              update: {},
            });
          }
          await tx.user.delete({ where: { id: u.id } });
        });
        deleted.push(u.id);
      } catch {
        failed.push({ id: u.id, name, reason: 'این کاربر سوابق دیگری (اموال، تیکت، پیام و …) دارد؛ به‌جای حذف غیرفعالش کنید' });
      }
    }
    return { ok: true, deleted: deleted.length, failed };
  }
}
