import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    if (payload?.jti) {
      try {
        const exists = await this.redis.exists(`bl:${String(payload.jti)}`);
        if (exists) return null;
      } catch (e) {
        this.logger.warn(`Redis blacklist check failed (${e instanceof Error ? e.message : e}); allowing token`);
      }
    }
    // This return value is attached to request.user
    return {
      userId: payload.user_id,
      username: payload.sub,
      organization_id: payload.organization_id,
      site_id: payload.site_id,
      roles: payload.roles,
      jti: payload.jti,
    };
  }
}
