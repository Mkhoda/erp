import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsService } from './permissions.service';
import { KNOWN_PAGES } from './pages.constant';

@UseGuards(JwtAuthGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private service: PermissionsService) {}

  // ── Page registry ──────────────────────────────────────────────────────────

  /** List all registered pages from DB (with isActive flag). Falls back to static list if DB empty. */
  @Get('pages')
  listPages() {
    return this.service.listPages();
  }

  /** Sync KNOWN_PAGES constant into the Page table — adds new pages, updates labels, keeps isActive. */
  @Post('pages/sync')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  syncPages() {
    return this.service.syncPages();
  }

  /** Enable or disable a page by its DB id. */
  @Patch('pages/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  setPageActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.service.setPageActive(id, body.isActive);
  }

  // ── Current user's effective menu ──────────────────────────────────────────
  @Get('menu')
  async menu(@Req() req: any, @Query('departmentId') departmentId?: string) {
    const user = req.user;
    if (departmentId && user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
      throw new ForbiddenException('Only admins or managers may request specific department permissions');
    }
    return this.service.menuForUser(user, departmentId);
  }

  // ── The caller's own flags on one page (view/create/edit/delete) ───────────
  @Get('my')
  my(@Req() req: any, @Query('page') page: string) {
    return this.service.myPageFlags(req.user, page);
  }

  // ── Per-person grants (in addition to department/role rows) — ADMIN only ───
  @Get('users')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  listUserGrants(@Query('userId') userId?: string) {
    return this.service.listUserGrants(userId);
  }

  @Post('users')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  upsertUserGrant(@Req() req: any, @Body() body: { userId: string; page: string; canRead?: boolean; canCreate?: boolean; canWrite?: boolean; canDelete?: boolean }) {
    return this.service.upsertUserGrant(req.user.userId ?? req.user.id, body);
  }

  @Delete('users/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  removeUserGrant(@Param('userId') userId: string, @Query('page') page: string) {
    return this.service.removeUserGrant(userId, page);
  }

  // ── All permission rows with dept info — admin management UI ───────────────
  @Get('all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  listAll() {
    return this.service.listAll();
  }

  // ── List rows for a specific department ────────────────────────────────────
  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  list(@Query('departmentId') departmentId: string, @Query('role') role?: string) {
    return this.service.list(departmentId, role);
  }

  // ── Upsert a permission row (dept + page + role) ───────────────────────────
  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  upsert(@Body() body: { departmentId: string; page: string; role?: string; canRead?: boolean; canCreate?: boolean; canWrite?: boolean; canDelete?: boolean }) {
    const { departmentId, page, role = '*', canRead, canCreate, canWrite, canDelete } = body;
    return this.service.upsert(departmentId, page, role, { canRead, canCreate, canWrite, canDelete });
  }

  // ── Sync defaults: upsert canRead=true rows for all pages × all depts ──────
  @Post('sync-defaults')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  syncDefaults() {
    return this.service.syncDefaults();
  }

  // ── Delete a permission row ────────────────────────────────────────────────
  @Delete(':departmentId/:page/:role')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  remove(
    @Param('departmentId') departmentId: string,
    @Param('page') page: string,
    @Param('role') role: string,
  ) {
    return this.service.remove(departmentId, page, role);
  }
}

