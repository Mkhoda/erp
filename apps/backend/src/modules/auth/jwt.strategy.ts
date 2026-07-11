import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { SessionsService } from '../sessions/sessions.service';
import { AuthSettingsService } from '../auth-settings/auth-settings.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private sessions: SessionsService,
    private authSettings: AuthSettingsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'devsecret',
    });
  }

  async validate(payload: any) {
    // Tokens issued before session management (no sid/gtv) pass through for backward compatibility.
    // New tokens always have both fields.
    if (payload.gtv !== undefined) {
      const settings = await this.authSettings.get();
      if (payload.gtv !== settings.globalTokenVersion) {
        throw new UnauthorizedException('Session invalidated by global logout');
      }
    }

    if (payload.sid) {
      const valid = await this.sessions.isSessionValid(payload.sid);
      if (!valid) throw new UnauthorizedException('Session revoked or expired');
      // Update lastSeenAt non-blocking
      this.sessions.touchSession(payload.sid);
    }

    return { userId: payload.sub, email: payload.email, role: payload.role, sessionId: payload.sid };
  }
}
