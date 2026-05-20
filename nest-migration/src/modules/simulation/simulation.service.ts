import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { resolveRedisUrl } from '../../config/env.validation';

@Injectable()
export class SimulationService {
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis(
      resolveRedisUrl() || this.configService.get<string>('REDIS_URL') || '',
    );
  }

  async getSimulationResult(simulationId: string) {
    const cached = await this.redis.get(`sim:${simulationId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Perform heavy 3D simulation logic here...
    const result = { data: 'complex_simulation_result' };

    await this.redis.set(`sim:${simulationId}`, JSON.stringify(result), 'EX', 3600);
    return result;
  }
}
