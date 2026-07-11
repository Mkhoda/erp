import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, LoginByPhoneDto, RegisterDto } from './dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';

function extractIp(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return (forwarded as string).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || '';
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: any) {
    return this.authService.register(dto, { ip: extractIp(req), userAgent: req.headers['user-agent'] });
  }

  @Post('login')
  login(@Body() dto: LoginDto & { rememberMe?: boolean }, @Req() req: any) {
    return this.authService.login(dto, {
      ip: extractIp(req),
      userAgent: req.headers['user-agent'],
      rememberMe: dto.rememberMe ?? false,
    });
  }

  @Post('login-phone')
  loginByPhone(@Body() dto: LoginByPhoneDto & { rememberMe?: boolean }, @Req() req: any) {
    return this.authService.loginByPhone(dto, {
      ip: extractIp(req),
      userAgent: req.headers['user-agent'],
      rememberMe: dto.rememberMe ?? false,
    });
  }

  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: any) {
    const coerced = { ...dto, otp: String((dto as any).otp) } as VerifyOtpDto;
    if ((process.env.LOG_BALE_VERBOSE || '').toLowerCase() === 'true' || process.env.LOG_BALE_VERBOSE === '1') {
      console.log('[AUTH] verify-otp requested for', coerced.phone);
    }
    return this.authService.verifyOtp(coerced, {
      ip: extractIp(req),
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    const coerced = { ...dto, otp: String((dto as any).otp) } as any;
    if ((process.env.LOG_BALE_VERBOSE || '').toLowerCase() === 'true' || process.env.LOG_BALE_VERBOSE === '1') {
      console.log('[AUTH] forgot-password verify requested for', coerced.phone);
    }
    return this.authService.forgotPassword(coerced);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    const coerced = { ...dto, otp: String((dto as any).otp) } as any;
    return this.authService.changePassword(req.user.userId, coerced);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true, role: true, password: true },
    });
    if (!user) return null;
    const { password, ...rest } = user as any;
    return { ...rest, hasPassword: Boolean(password) };
  }

  // Revoke the calling user's current session (logout)
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: any) {
    if (req.user.sessionId) {
      await this.sessions.revokeSession(req.user.sessionId, req.user.userId);
    }
    return { ok: true };
  }

  // Revoke all sessions for the calling user (logout everywhere)
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(@Req() req: any) {
    await this.sessions.revokeUserSessions(req.user.userId);
    return { ok: true };
  }

  // Get current user's own active sessions
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async mySessions(@Req() req: any) {
    return this.sessions.getUserSessions(req.user.userId, req.user.sessionId);
  }

  // Revoke a specific session belonging to the current user
  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  async revokeMySession(@Param('id') id: string, @Req() req: any) {
    const session = await this.prisma.session.findUnique({ where: { id }, select: { userId: true } });
    if (!session || session.userId !== req.user.userId) {
      return { ok: false, message: 'Not found' };
    }
    await this.sessions.revokeSession(id, req.user.userId);
    return { ok: true };
  }

  // Admin: revoke any user's all sessions
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('users/:userId/logout')
  async adminLogoutUser(@Param('userId') userId: string, @Req() req: any) {
    await this.sessions.revokeUserSessions(userId);
    return { ok: true };
  }
}
