import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
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
      const exists = await this.redis.exists(`bl:${String(payload.jti)}`);
      if (exists) return null;
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
