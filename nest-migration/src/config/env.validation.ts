const INSECURE_JWT_VALUES = new Set(['change_me', 'changeme', 'secret', '']);

const MONGO_PLACEHOLDER_MARKERS = ['<db_password>', '<password>', 'YOUR_PASSWORD'];

function mongoUrlHasPlaceholder(url: string): boolean {
  return MONGO_PLACEHOLDER_MARKERS.some((m) => url.includes(m));
}

/** Extrae user/host/db de una URI Atlas aunque la contraseña sea un placeholder. */
function parseMongoUriParts(url: string): {
  user: string;
  host: string;
  db: string;
  query: string;
} | null {
  const m = url.match(
    /^mongodb(\+srv)?:\/\/([^:@/]+)(?::[^@]*)?@([^/]+)\/([^?]*)(\?.*)?$/i,
  );
  if (!m) return null;
  return {
    user: decodeURIComponent(m[2]),
    host: m[3],
    db: m[4] || 'cop',
    query: (m[5] ?? '').replace(/^\?/, '') || 'retryWrites=true&w=majority&appName=Cluster0',
  };
}

const MONGO_PASSWORD_ENV_KEYS = [
  'MONGODB_PASSWORD',
  'MONGO_PASSWORD',
  'ATLAS_PASSWORD',
  'DB_PASSWORD',
] as const;

/** Contraseña Atlas desde variables dedicadas (Render suele olvidar MONGODB_PASSWORD). */
export function resolveMongoPassword(): string {
  for (const key of MONGO_PASSWORD_ENV_KEYS) {
    const v = (process.env[key] ?? '').trim();
    if (v && !mongoUrlHasPlaceholder(v)) return v;
  }
  return '';
}

function redisUrlStatus(raw: string | undefined): string {
  const redis = normalizeRedisUrl(raw);
  if (!redis) return 'missing';
  const lower = redis.toLowerCase();
  if (
    lower.includes('your-instance.upstash.io') ||
    lower.includes('your_upstash_token') ||
    lower.includes('example.upstash.io')
  ) {
    return 'placeholder';
  }
  if (lower.startsWith('redis://') || lower.startsWith('rediss://')) {
    return `ok(${lower.startsWith('rediss://') ? 'tls' : 'plain'})`;
  }
  return 'invalid';
}

/** Log seguro en Render (sin secretos) para ver qué variables llegaron al contenedor. */
export function logMongoEnvDiagnostic(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const url = (process.env.MONGODB_URL ?? '').trim();
  const dbUrl = (process.env.DATABASE_URL ?? '').trim();
  const pass = resolveMongoPassword();
  const parts = [
    `MONGODB_URL=${url ? (mongoUrlHasPlaceholder(url) ? 'placeholder' : 'ok') : 'missing'}`,
    `DATABASE_URL=${dbUrl.startsWith('mongodb') ? (mongoUrlHasPlaceholder(dbUrl) ? 'placeholder' : 'ok') : 'unset'}`,
    `MONGODB_PASSWORD=${pass ? `set(len=${pass.length})` : 'missing'}`,
    `REDIS_URL=${redisUrlStatus(process.env.REDIS_URL)}`,
  ];
  console.error(`[cop-nest-api] Env check: ${parts.join(' ')}`);
}

/**
 * URI final para Mongoose. Si MONGODB_URL trae `<db_password>`, usa MONGODB_PASSWORD (Render).
 */
export function resolveMongoUrl(): string {
  const databaseUrl = (process.env.DATABASE_URL ?? '').trim();
  if (databaseUrl.startsWith('mongodb') && !mongoUrlHasPlaceholder(databaseUrl)) {
    return databaseUrl;
  }

  const direct = (process.env.MONGODB_URL ?? '').trim();
  const password = resolveMongoPassword();

  if (direct && !mongoUrlHasPlaceholder(direct)) {
    return direct;
  }

  if (!password) {
    return direct;
  }

  const parts = direct ? parseMongoUriParts(direct) : null;
  const user = encodeURIComponent(
    process.env.MONGODB_USER?.trim() || parts?.user || 'nelsonherazoi',
  );
  const pass = encodeURIComponent(password);
  const host =
    process.env.MONGODB_HOST?.trim() || parts?.host || 'cluster0.6oyhyja.mongodb.net';
  const db = process.env.MONGODB_DB?.trim() || parts?.db || 'cop';
  const query =
    process.env.MONGODB_OPTIONS?.trim() ||
    parts?.query ||
    'retryWrites=true&w=majority&appName=Cluster0';

  return `mongodb+srv://${user}:${pass}@${host}/${db}?${query}`;
}

/** Escribe la URI resuelta en process.env para ConfigService / Mongoose. */
export function applyResolvedMongoUrlFromEnv(): void {
  const resolved = resolveMongoUrl();
  if (resolved && !mongoUrlHasPlaceholder(resolved)) {
    process.env.MONGODB_URL = resolved;
  }
}

/**
 * Quita prefijos pegados por error (p. ej. `redis-cli --tls -u `) y comillas.
 * Usa la URL tal como la muestra Upstash (`rediss://...` con TLS), no un comando CLI.
 */
export function normalizeRedisUrl(raw: string | undefined): string {
  if (raw == null) return '';
  let s = raw.trim().replace(/^['"]|['"]$/g, '');
  // Valores pegados desde algunas UIs o CLI llegan con espacios como %20
  s = s.replace(/%(?:20|09)/gi, ' ').trim();
  const lower = s.toLowerCase();
  const redissAt = lower.indexOf('rediss://');
  const redisAt = lower.indexOf('redis://');
  if (redissAt >= 0) s = s.slice(redissAt);
  else if (redisAt >= 0) s = s.slice(redisAt);
  s = s.trim();
  // Quitar basura tras la URI (p. ej. comillas o texto colado)
  const compact = s.match(/^(rediss?:\/\/\S+)/i);
  return compact ? compact[1]! : s;
}

/** Aplica normalización a process.env para que Config / ioredis reciban solo la URI. */
export function applyNormalizedRedisUrlFromEnv(): void {
  const current = process.env.REDIS_URL;
  if (current === undefined || current === '') return;
  process.env.REDIS_URL = normalizeRedisUrl(current);
}

/** Orígenes permitidos: CORS_ORIGINS o, si falta, DASHBOARD_URL + PUBLIC_SITE_URL. */
export function resolveCorsOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (fromEnv.length) {
    return [...new Set(fromEnv)];
  }

  const derived = [process.env.DASHBOARD_URL, process.env.PUBLIC_SITE_URL]
    .map((u) => (u ?? '').trim())
    .filter((u) => u.startsWith('http://') || u.startsWith('https://'));

  return [...new Set(derived)];
}

/** Lista de problemas de configuración en producción (para un solo mensaje en logs de Render). */
export function collectProductionEnvErrors(): string[] {
  if (process.env.NODE_ENV !== 'production') {
    return [];
  }

  const errors: string[] = [];

  const jwt = (process.env.JWT_SECRET ?? '').trim();
  if (!jwt || INSECURE_JWT_VALUES.has(jwt.toLowerCase())) {
    errors.push(
      'JWT_SECRET: usa un valor aleatorio fuerte (Render puede generarlo con generateValue en render.yaml).',
    );
  }

  const cors = resolveCorsOrigins();
  if (!cors.length) {
    errors.push(
      'CORS: define CORS_ORIGINS o DASHBOARD_URL + PUBLIC_SITE_URL (URLs https de tus frontends).',
    );
  }

  const mongo = resolveMongoUrl();
  if (!mongo) {
    errors.push('MONGODB_URL o MONGODB_PASSWORD: al menos uno con valor real.');
  } else if (mongoUrlHasPlaceholder(mongo)) {
    logMongoEnvDiagnostic();
    errors.push(
      'MongoDB: MONGODB_PASSWORD vacía en Render (cop-nest-api → Environment). El archivo deploy/env.production.example en Git NO se aplica solo — debes pegar la variable en el dashboard.',
    );
  }

  const redis = normalizeRedisUrl(process.env.REDIS_URL);
  if (!redis) {
    errors.push(
      'REDIS_URL: vacía. Sync Blueprint (servicio cop-redis) y borra REDIS_URL manual con placeholder en Environment; o pega rediss:// de Upstash.',
    );
  } else if (!redis.startsWith('redis://') && !redis.startsWith('rediss://')) {
    errors.push(
      'REDIS_URL: debe empezar por redis:// o rediss:// (sin prefijo redis-cli).',
    );
  } else {
    const redisLower = redis.toLowerCase();
    if (
      redisLower.includes('your-instance.upstash.io') ||
      redisLower.includes('your_upstash_token') ||
      redisLower.includes('example.upstash.io')
    ) {
      errors.push(
        'REDIS_URL: sigue siendo el placeholder de ejemplo; pega la URL real de Upstash.',
      );
    }
  }

  if (process.env.WOMPI_SKIP_WEBHOOK_VERIFY === 'true') {
    errors.push('WOMPI_SKIP_WEBHOOK_VERIFY no puede ser true en producción.');
  }

  return errors;
}

export function assertProductionEnv(): void {
  const errors = collectProductionEnvErrors();
  if (errors.length) {
    throw new Error(
      `Production env check failed (${errors.length} issue(s)):\n- ${errors.join('\n- ')}\n→ Render: cop-nest-api → Environment → Save → Manual Deploy. Ver deploy/RENDER.md`,
    );
  }
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
