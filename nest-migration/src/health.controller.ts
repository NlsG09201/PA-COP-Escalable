import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import Redis from 'ioredis';

type CheckStatus = 'ok' | 'error';

@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  @Get('/health')
  async health() {
    const [mongodb, redis] = await Promise.all([
      this.checkMongo(),
      this.checkRedis(),
    ]);

    const checks = { mongodb, redis };
    const healthy = Object.values(checks).every((c) => c === 'ok');
    const body = {
      status: healthy ? 'ok' : 'degraded',
      checks,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeEnv: process.env.NODE_ENV ?? 'development',
    };

    if (!healthy) {
      throw new ServiceUnavailableException(body);
    }

    return body;
  }

  @Get('/health/live')
  live() {
    return { status: 'ok' };
  }

  private async checkMongo(): Promise<CheckStatus> {
    try {
      if (this.mongo.readyState !== 1 || !this.mongo.db) {
        return 'error';
      }
      await this.mongo.db.admin().command({ ping: 1 });
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<CheckStatus> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }
}
