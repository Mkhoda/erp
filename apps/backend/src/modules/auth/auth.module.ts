import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { BaleService } from './bale.service';
import { SessionsModule } from '../sessions/sessions.module';
import { AuthSettingsModule } from '../auth-settings/auth-settings.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    PassportModule,
    SessionsModule,
    AuthSettingsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'devsecret',
        // No global expiresIn — it is set dynamically per signAsync call from AuthSettingsService
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PrismaService, BaleService],
  exports: [AuthService],
})
export class AuthModule {}
