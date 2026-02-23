import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, LoginByPhoneDto, RegisterDto } from './dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('login-phone')
  loginByPhone(@Body() dto: LoginByPhoneDto) {
    return this.authService.loginByPhone(dto);
  }

  // OTP endpoints
  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    // Ensure otp is treated as string of digits
    const coerced = { ...dto, otp: String((dto as any).otp) } as VerifyOtpDto;
    if ((process.env.LOG_BALE_VERBOSE || '').toLowerCase() === 'true' || process.env.LOG_BALE_VERBOSE === '1') {
      // eslint-disable-next-line no-console
      console.log('[AUTH] verify-otp requested for', coerced.phone);
    }
    return this.authService.verifyOtp(coerced);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    const coerced = { ...dto, otp: String((dto as any).otp) } as any;
    if ((process.env.LOG_BALE_VERBOSE || '').toLowerCase() === 'true' || process.env.LOG_BALE_VERBOSE === '1') {
      // eslint-disable-next-line no-console
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
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        password: true,
      },
    });
    if (!user) return null;
    const { password, ...rest } = user as any;
    return { ...rest, hasPassword: Boolean(password) };
  }
}
