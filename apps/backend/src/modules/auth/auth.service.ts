import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { LoginDto, RegisterDto } from './dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { BaleService } from './bale.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private bale: BaleService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const phone = this.normalizePhone(dto.phone);
    const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingByEmail) throw new BadRequestException('Email already in use');
    const existingByPhone = await this.prisma.user.findFirst({ where: { phone } });
    if (existingByPhone) throw new BadRequestException('Phone already in use');
    const hashed = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashed,
          firstName,
          lastName,
          phone,
          role: 'USER',
        },
      });
      return this.signUser(user.id, user.email, user.role);
    } catch (err: any) {
      // Handle unique constraint race condition
      if (err?.code === 'P2002') {
        throw new BadRequestException('Email or phone already in use');
      }
      throw err;
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.password) throw new UnauthorizedException('Password not set');
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return this.signUser(user.id, user.email, user.role);
  }

  // Normalize to 98xxxxxxxxxx
  normalizePhone(input: string) {
    const digits = input.replace(/\D/g, '');
    if (digits.startsWith('98') && digits.length === 12) return digits;
    if (digits.startsWith('0') && digits.length === 11) return '98' + digits.slice(1);
    if (digits.length === 10) return '98' + digits; // assume without leading 0
    if (digits.startsWith('9') && digits.length === 10) return '98' + digits;
    throw new BadRequestException('Invalid phone number');
  }

  private makeOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private messageTemplate(purpose: 'login' | 'forgot' | 'change' | 'signup', otp: string): string {
    if (purpose === 'login') {
      return `کد ورود شما به حساب کاربری:\n${otp}\nلطفاً این کد را در صفحه ورود وارد کنید.\nاین کد فقط ۵ دقیقه اعتبار دارد.`;
    }
    if (purpose === 'forgot') {
      return `کد بازیابی رمز عبور شما:\n${otp}\nلطفاً این کد را در صفحه بازیابی رمز وارد کنید.\nتوجه: این کد فقط ۵ دقیقه معتبر است.`;
    }
    if (purpose === 'signup') {
      return `کد تأیید ثبت‌نام شما:\n${otp}\nبرای ادامه ثبت‌نام این کد را وارد کنید.\nاین کد ۵ دقیقه اعتبار دارد.`;
    }
    return `برای تغییر رمز عبور، کد تأیید شما:\n${otp}\nلطفاً این کد را در بخش تغییر رمز وارد کنید.\nاین کد تنها ۵ دقیقه اعتبار دارد.`;
  }

  async sendOtp(dto: SendOtpDto) {
    const phone = this.normalizePhone(dto.phone);
    const verbose = (process.env.LOG_BALE_VERBOSE || '').toLowerCase() === 'true' || process.env.LOG_BALE_VERBOSE === '1';
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log(`[AUTH] sendOtp requested for ${phone} (purpose=${dto.purpose})`);
    }
    const existingUser = await this.prisma.user.findFirst({ where: { phone } });
    if (dto.purpose === 'signup') {
      // For signup, phone must NOT be registered yet
      if (existingUser) {
        throw new BadRequestException('Phone already in use');
      }
      if (verbose) {
        // eslint-disable-next-line no-console
        console.log(`[AUTH] sendOtp permitted for unregistered phone ${phone} (purpose=signup)`);
      }
    } else {
      // For login/forgot/change, phone must exist
      if (!existingUser) {
        throw new NotFoundException('کاربری با این شماره یافت نشد');
      }
    }
    // Rate limit: allow max 30 per hour per phone
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const count = await this.prisma.otp.count({ where: { phone, createdAt: { gt: cutoff } } as any });
    if (count >= 30) throw new ForbiddenException('OTP request limit reached');
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log(`[AUTH] OTPs sent in the last hour for ${phone}: ${count}`);
    }

    const otp = this.makeOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await this.prisma.otp.create({ data: { phone, code: otp, expiresAt } });

  // Send via Bale
  await this.bale.sendOtp(phone, otp);
    // Never expose OTP value in logs or API response
    // eslint-disable-next-line no-console
    console.log(`[BALE${process.env.BALE_MOCK === 'true' ? '_MOCK' : ''}] OTP request accepted for ${phone}, expires at ${expiresAt.toISOString()}`);
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log('[AUTH] OTP created and stored; expiresAt:', expiresAt.toISOString());
    }
    return { ok: true, expiresAt };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const phone = this.normalizePhone(dto.phone);
    const record = await this.prisma.otp.findFirst({
      where: { phone, code: dto.otp },
      orderBy: { createdAt: 'desc' },
    } as any);
    if (!record) throw new UnauthorizedException('Invalid OTP');
    if (record.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('OTP expired');

    // Find user by phone (must exist due to sendOtp check)
    const user = await this.prisma.user.findFirst({ where: { phone } });
    if (!user) throw new UnauthorizedException('Invalid OTP');

    // Optionally clean used OTPs
    await this.prisma.otp.deleteMany({ where: { phone } });

    const token = await this.signUser(user.id, user.email, user.role);
    return { ...token, user: { id: user.id, phone: user.phone, email: user.email } };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const phone = this.normalizePhone(dto.phone);
    const user = await this.prisma.user.findFirst({ where: { phone } });
    if (!user) throw new NotFoundException('User not found');

    const record = await this.prisma.otp.findFirst({
      where: { phone, code: dto.otp },
      orderBy: { createdAt: 'desc' },
    } as any);
    if (!record) throw new UnauthorizedException('Invalid OTP');
    if (record.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('OTP expired');

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    await this.prisma.otp.deleteMany({ where: { phone } });
    return { ok: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.phone) throw new NotFoundException('User not found');
    const phone = user.phone;
    const record = await this.prisma.otp.findFirst({
      where: { phone, code: dto.otp },
      orderBy: { createdAt: 'desc' },
    } as any);
    if (!record) throw new UnauthorizedException('Invalid OTP');
    if (record.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('OTP expired');

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    await this.prisma.otp.deleteMany({ where: { phone } });
    return { ok: true };
  }

  private async signUser(sub: string, email: string, role: string) {
    const token = await this.jwt.signAsync({ sub, email, role });
    return { access_token: token };
  }
}
