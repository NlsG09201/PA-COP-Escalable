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

/**
 * URI final para Mongoose. Si MONGODB_URL trae `<db_password>`, usa MONGODB_PASSWORD (Render).
 */
export function resolveMongoUrl(): string {
  const direct = (process.env.MONGODB_URL ?? '').trim();
  const password = (process.env.MONGODB_PASSWORD ?? '').trim();

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

export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const jwt = (process.env.JWT_SECRET ?? '').trim();
  if (!jwt || INSECURE_JWT_VALUES.has(jwt.toLowerCase())) {
    throw new Error(
      'JWT_SECRET must be set to a strong random value when NODE_ENV=production',
    );
  }

  const cors = resolveCorsOrigins();
  if (!cors.length) {
    throw new Error(
      'Set CORS_ORIGINS (comma-separated) or both DASHBOARD_URL and PUBLIC_SITE_URL in Render. Example: CORS_ORIGINS=https://tu-panel.vercel.app,https://tu-web.vercel.app',
    );
  }

  const mongo = resolveMongoUrl();
  if (!mongo) {
    throw new Error(
      'MONGODB_URL or MONGODB_PASSWORD is required when NODE_ENV=production',
    );
  }
  if (mongoUrlHasPlaceholder(mongo)) {
    throw new Error(
      'MongoDB password missing: set MONGODB_PASSWORD in Render (Atlas user password), or replace <db_password> inside MONGODB_URL.',
    );
  }

  const redis = normalizeRedisUrl(process.env.REDIS_URL);
  if (!redis) {
    throw new Error('REDIS_URL is required when NODE_ENV=production');
  }
  if (!redis.startsWith('redis://') && !redis.startsWith('rediss://')) {
    throw new Error(
      'REDIS_URL must start with redis:// or rediss:// (Upstash: use the TLS URL rediss://... from the console, not redis-cli)',
    );
  }
  const redisLower = redis.toLowerCase();
  if (
    redisLower.includes('your-instance.upstash.io') ||
    redisLower.includes('your_upstash_token') ||
    redisLower.includes('example.upstash.io')
  ) {
    throw new Error(
      'REDIS_URL is still the example placeholder (your-instance.upstash.io). In Upstash Console copy the real rediss:// URL and paste only that in Render → Environment → REDIS_URL.',
    );
  }

  if (process.env.WOMPI_SKIP_WEBHOOK_VERIFY === 'true') {
    throw new Error(
      'WOMPI_SKIP_WEBHOOK_VERIFY must not be true in production',
    );
  }
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
