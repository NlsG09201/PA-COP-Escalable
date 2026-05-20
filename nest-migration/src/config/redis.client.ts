import Redis from 'ioredis';
import { isProduction, resolveRedisUrl } from './env.validation';

/** Tras WRONGPASS, JWT y simulacion no dependen de Redis hasta reinicio con URL valida. */
let redisAuthFailed = false;

export function isRedisAuthFailed(): boolean {
  return redisAuthFailed;
}

function isWrongPassError(err: Error): boolean {
  const msg = err.message ?? '';
  return /WRONGPASS|invalid username-password/i.test(msg);
}

function attachRedisErrorHandler(client: Redis, source: string): void {
  let wrongPassLogged = false;
  client.on('error', (err: Error) => {
    if (isWrongPassError(err)) {
      redisAuthFailed = true;
      if (!wrongPassLogged) {
        wrongPassLogged = true;
        console.error(
          `[cop-nest-api] REDIS_URL (${source}): token/contrasena incorrecto (WRONGPASS). ` +
            'Upstash: Console -> tu base -> Connect -> copia de nuevo REDIS_URL. ' +
            'O en Render borra REDIS_URL manual y Sync Blueprint para usar cop-redis.',
        );
      }
      return;
    }
    console.error(`[cop-nest-api] Redis (${source}): ${err.message}`);
  });
}

function warnIfTokenLooksCorrupt(url: string): void {
  try {
    const normalized = url.replace(/^redis:\/\//i, 'https://').replace(/^rediss:\/\//i, 'https://');
    const parsed = new URL(normalized);
    const pass = decodeURIComponent(parsed.password ?? '');
    if (pass.length < 16 || /AAAA{4,}|YOUR_UPSTASH|example/i.test(pass)) {
      console.error(
        '[cop-nest-api] REDIS_URL: el token parece truncado o placeholder. Regenera la URL en Upstash Connect.',
      );
    }
  } catch {
    /* ignore */
  }
}

/** Cliente Redis compartido; sin URL usa lazyConnect (no tumba el arranque en Render). */
export function createRedisClient(explicitUrl?: string): Redis {
  const url = (explicitUrl ?? resolveRedisUrl()).trim();
  if (url) {
    warnIfTokenLooksCorrupt(url);
    const client = new Redis(url, {
      maxRetriesPerRequest: 3,
      connectTimeout: 10_000,
      lazyConnect: false,
      reconnectOnError(err) {
        return !isWrongPassError(err);
      },
      retryStrategy(times) {
        if (redisAuthFailed || times > 8) return null;
        return Math.min(times * 250, 3_000);
      },
    });
    attachRedisErrorHandler(client, 'app');
    return client;
  }

  console.error(
    '[cop-nest-api] REDIS_URL no configurada: la API arranca en modo degradado (sin colas Bull ni blacklist JWT en Redis). Anade REDIS_URL en Render o Sync Blueprint cop-redis.',
  );

  const client = new Redis({
    host: '127.0.0.1',
    port: 6379,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
    connectTimeout: 2_000,
  });
  attachRedisErrorHandler(client, 'degraded');
  return client;
}

/** URL presente y token no parece truncado/placeholder (evita Bull con WRONGPASS al arranque). */
export function isRedisUrlLooksValid(): boolean {
  const url = resolveRedisUrl();
  if (!url) return false;
  try {
    const normalized = url.replace(/^redis:\/\//i, 'https://').replace(/^rediss:\/\//i, 'https://');
    const parsed = new URL(normalized);
    const pass = decodeURIComponent(parsed.password ?? '');
    if (pass.length < 16 || /AAAA{4,}|YOUR_UPSTASH|example/i.test(pass)) return false;
    return true;
  } catch {
    return false;
  }
}

export function isRedisConfigured(): boolean {
  return isRedisUrlLooksValid() && !redisAuthFailed;
}

/** Sin Redis o credenciales invalidas: no bloquear JWT por blacklist. */
export function allowJwtWhenRedisDown(): boolean {
  if (!isProduction()) return true;
  return !resolveRedisUrl() || redisAuthFailed;
}
