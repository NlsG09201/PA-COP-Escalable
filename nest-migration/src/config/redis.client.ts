import Redis from 'ioredis';
import { isProduction, resolveRedisUrl } from './env.validation';

/** Cliente Redis compartido; sin URL usa lazyConnect (no tumba el arranque en Render). */
export function createRedisClient(explicitUrl?: string): Redis {
  const url = (explicitUrl ?? resolveRedisUrl()).trim();
  if (url) {
    return new Redis(url, {
      maxRetriesPerRequest: 3,
      connectTimeout: 10_000,
      lazyConnect: false,
    });
  }

  console.error(
    '[cop-nest-api] REDIS_URL no configurada: la API arranca en modo degradado (sin colas Bull ni blacklist JWT en Redis). Anade REDIS_URL en Render o Sync Blueprint cop-redis.',
  );

  return new Redis({
    host: '127.0.0.1',
    port: 6379,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
    connectTimeout: 2_000,
  });
}

export function isRedisConfigured(): boolean {
  return Boolean(resolveRedisUrl());
}

/** En producción sin Redis, no rechazar JWT por fallo de blacklist (sesiones siguen válidas). */
export function allowJwtWhenRedisDown(): boolean {
  return !isRedisConfigured() || !isProduction();
}
