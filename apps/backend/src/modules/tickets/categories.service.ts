import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto, UpsertDeptConfigDto } from './dto/ticket.dto';

// Every department gets this catch-all category automatically — lets a
// requester file a ticket that doesn't fit any configured category, writing
// their own subject instead (see Ticket.title / CreateTicketDto.title).
export const OTHER_CATEGORY_NAME = 'سایر';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  private async ensureOtherCategory(configId: string) {
    await this.prisma.ticketCategory.upsert({
      where: { configId_name: { configId, name: OTHER_CATEGORY_NAME } },
      create: { configId, name: OTHER_CATEGORY_NAME, order: 999, isActive: true },
      update: {},
    });
  }

  // ── Department Configs ────────────────────────────────────────────

  async getAllConfigs() {
    return this.prisma.ticketDepartmentConfig.findMany({
      include: {
        department: { select: { id: true, name: true } },
        managers: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        defaultAssignees: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        _count: { select: { categories: true } },
      },
      orderBy: { department: { name: 'asc' } },
    });
  }

  async getEnabledConfigs() {
    const include = {
      department: { select: { id: true, name: true } },
      categories: { where: { isActive: true }, orderBy: { order: 'asc' as const } },
    };
    const configs = await this.prisma.ticketDepartmentConfig.findMany({
      where: { isEnabled: true },
      include,
      orderBy: { department: { name: 'asc' } },
    });

    // Backfill "سایر" for any department that doesn't have it yet (covers
    // configs created before this fallback existed) so every department
    // shows it by default without a manual migration.
    const missing = configs.filter((c) => !c.categories.some((cat) => cat.name === OTHER_CATEGORY_NAME));
    if (missing.length === 0) return configs;

    await Promise.all(missing.map((c) => this.ensureOtherCategory(c.id)));
    return this.prisma.ticketDepartmentConfig.findMany({
      where: { isEnabled: true },
      include,
      orderBy: { department: { name: 'asc' } },
    });
  }

  async getConfig(departmentId: string) {
    return this.prisma.ticketDepartmentConfig.findUnique({
      where: { departmentId },
      include: {
        department: { select: { id: true, name: true } },
        managers: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
        defaultAssignees: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        categories: { orderBy: { order: 'asc' } },
      },
    });
  }

  async upsertConfig(dto: UpsertDeptConfigDto) {
    const dept = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
    if (!dept) throw new NotFoundException('دپارتمان پیدا نشد');

    const { managerIds, defaultAssigneeIds, departmentId, ...rest } = dto;

    const config = await this.prisma.ticketDepartmentConfig.upsert({
      where: { departmentId },
      create: { departmentId, ...rest },
      update: rest,
    });

    if (managerIds !== undefined) {
      await this.prisma.ticketDeptManager.deleteMany({ where: { configId: config.id } });
      if (managerIds.length) {
        await this.prisma.ticketDeptManager.createMany({
          data: managerIds.map(uid => ({ configId: config.id, userId: uid })),
          skipDuplicates: true,
        });
      }
    }

    if (defaultAssigneeIds !== undefined) {
      await this.prisma.ticketDeptAssignee.deleteMany({ where: { configId: config.id } });
      if (defaultAssigneeIds.length) {
        await this.prisma.ticketDeptAssignee.createMany({
          data: defaultAssigneeIds.map(uid => ({ configId: config.id, userId: uid })),
          skipDuplicates: true,
        });
      }
    }

    await this.ensureOtherCategory(config.id);
    return this.getConfig(departmentId);
  }

  // ── Categories ────────────────────────────────────────────────────

  async getCategoriesByConfig(configId: string) {
    return this.prisma.ticketCategory.findMany({
      where: { configId },
      orderBy: { order: 'asc' },
    });
  }

  async getCategoriesByDept(departmentId: string) {
    const config = await this.prisma.ticketDepartmentConfig.findUnique({ where: { departmentId } });
    if (!config) return [];
    await this.ensureOtherCategory(config.id);
    return this.prisma.ticketCategory.findMany({
      where: { configId: config.id, isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const existing = await this.prisma.ticketCategory.findUnique({
      where: { configId_name: { configId: dto.configId, name: dto.name } },
    });
    if (existing) throw new ConflictException('این موضوع قبلاً ثبت شده است');
    return this.prisma.ticketCategory.create({ data: dto });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const cat = await this.prisma.ticketCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException();
    if (dto.name && dto.name !== cat.name) {
      const dup = await this.prisma.ticketCategory.findUnique({
        where: { configId_name: { configId: cat.configId, name: dto.name } },
      });
      if (dup) throw new ConflictException('این موضوع قبلاً ثبت شده است');
    }
    return this.prisma.ticketCategory.update({ where: { id }, data: dto });
  }

  async deleteCategory(id: string) {
    const inUse = await this.prisma.ticket.count({ where: { categoryId: id } });
    if (inUse > 0) {
      return this.prisma.ticketCategory.update({ where: { id }, data: { isActive: false } });
    }
    return this.prisma.ticketCategory.delete({ where: { id } });
  }

  // ── Settings ──────────────────────────────────────────────────────

  async getSettings() {
    return this.prisma.ticketSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });
  }

  async updateSettings(data: any, updatedById: string) {
    return this.prisma.ticketSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data, updatedById },
      update: { ...data, updatedById },
    });
  }
}
