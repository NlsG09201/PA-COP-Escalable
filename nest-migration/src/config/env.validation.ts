import { existsSync, readdirSync, readFileSync } from 'fs';

const INSECURE_JWT_VALUES = new Set(['change_me', 'changeme', 'secret', '']);

/** Archivos montados por Render → Secret Files (un .env o claves sueltas). */
const RENDER_SECRET_ENV_FILES = [
  '/etc/secrets/cop-production.env',
  '/etc/secrets/render-upload.env',
  '/etc/secrets/.env',
] as const;

const RENDER_SECRET_SINGLE_KEYS = [
  'MONGODB_PASSWORD',
  'REDIS_URL',
  'JWT_SECRET',
  'CORS_ORIGINS',
  'J48_URL',
] as const;

/** Siempre reemplazar desde secret file / COP_PRODUCTION_ENV* (Render suele dejar placeholders). */
const FORCE_OVERRIDE_FROM_SECRETS = new Set([
  'MONGODB_PASSWORD',
  'REDIS_URL',
  'MONGODB_URL',
]);

function isBadRedisValue(raw: string): boolean {
  const redis = normalizeRedisUrl(raw);
  if (!redis) return true;
  const lower = redis.toLowerCase();
  return (
    lower.includes('your-instance.upstash.io') ||
    lower.includes('your_upstash_token') ||
    lower.includes('example.upstash.io')
  );
}

function shouldOverrideEnv(key: string, value: string): boolean {
  const current = (process.env[key] ?? '').trim();
  if (!value) return false;
  if (!current) return true;
  if (key === 'REDIS_URL' && isBadRedisValue(current)) return true;
  if (key === 'MONGODB_PASSWORD') {
    if (!current) return true;
    return mongoUrlHasPlaceholder(process.env.MONGODB_URL ?? '');
  }
  if (key === 'MONGODB_URL' && mongoUrlHasPlaceholder(current)) return true;
  return false;
}

function applyEnvFileContent(
  content: string,
  source: string,
  forceKeys: ReadonlySet<string> = FORCE_OVERRIDE_FROM_SECRETS,
): void {
  let count = 0;
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!key) continue;
    const force = forceKeys.has(key);
    if (!force && !shouldOverrideEnv(key, value)) continue;
    process.env[key] = value;
    count += 1;
  }
  if (count > 0) {
    console.error(`[cop-nest-api] Loaded ${count} env var(s) from ${source}`);
  }
}

/** Render/K8s monta secret files bajo /etc/secrets/..data/<filename>. */
function discoverRenderSecretDirs(): string[] {
  const secretsDir = '/etc/secrets';
  if (!existsSync(secretsDir)) return [];

  const dirs = new Set<string>([`${secretsDir}/..data`]);
  try {
    for (const name of readdirSync(secretsDir)) {
      if (name === '..data' || name.startsWith('..20')) {
        dirs.add(`${secretsDir}/${name}`);
      }
    }
  } catch {
    /* ignore */
  }
  return [...dirs].filter((d) => existsSync(d));
}

function discoverRenderSecretFilePaths(): string[] {
  const paths = new Set<string>([...RENDER_SECRET_ENV_FILES]);

  for (const dir of discoverRenderSecretDirs()) {
    for (const base of ['cop-production.env', 'render-upload.env', '.env']) {
      paths.add(`${dir}/${base}`);
    }
    try {
      for (const name of readdirSync(dir)) {
        if (name.startsWith('..')) continue;
        paths.add(`${dir}/${name}`);
      }
    } catch {
      /* ignore */
    }
  }

  for (const key of RENDER_SECRET_SINGLE_KEYS) {
    paths.add(`/etc/secrets/${key}`);
    for (const dir of discoverRenderSecretDirs()) {
      paths.add(`${dir}/${key}`);
    }
  }

  return [...paths];
}

function logRenderSecretsMountDiagnostic(): void {
  const secretsDir = '/etc/secrets';
  if (!existsSync(secretsDir)) {
    console.error(
      '[cop-nest-api] /etc/secrets not mounted — usa Secret File cop-production.env, COP_PRODUCTION_ENV_B64, o variables en Environment',
    );
    return;
  }
  try {
    const names = readdirSync(secretsDir);
    console.error(
      `[cop-nest-api] /etc/secrets (${names.length} entries): ${names.join(', ') || '(empty)'}`,
    );
    for (const dir of discoverRenderSecretDirs()) {
      try {
        const inner = readdirSync(dir).filter((n) => !n.startsWith('..'));
        console.error(
          `[cop-nest-api] ${dir} (${inner.length} file(s)): ${inner.join(', ') || '(empty — sube cop-production.env en Secret Files)'}`,
        );
      } catch {
        console.error(`[cop-nest-api] ${dir}: could not list`);
      }
    }
  } catch {
    console.error('[cop-nest-api] /etc/secrets exists but could not list');
  }
}

/**
 * Render Secret Files: sube deploy/render-upload.env como cop-production.env
 * (Dashboard → cop-nest-api → Environment → Secret Files).
 */
export function loadRenderSecretEnv(): void {
  const inline = (process.env.COP_PRODUCTION_ENV ?? '').trim();
  if (inline) {
    applyEnvFileContent(inline, 'COP_PRODUCTION_ENV');
  }

  const b64 = (process.env.COP_PRODUCTION_ENV_B64 ?? '').trim();
  if (b64) {
    try {
      applyEnvFileContent(
        Buffer.from(b64, 'base64').toString('utf8'),
        'COP_PRODUCTION_ENV_B64',
      );
    } catch {
      console.error('[cop-nest-api] COP_PRODUCTION_ENV_B64 invalid (not base64 UTF-8)');
    }
  }

  const secretPaths = discoverRenderSecretFilePaths();
  for (const filePath of secretPaths) {
    if (!existsSync(filePath)) continue;
    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (trimmed.includes('=') && (trimmed.includes('\n') || filePath.endsWith('.env'))) {
      applyEnvFileContent(raw, filePath);
      continue;
    }

    const key = filePath.split('/').pop() ?? '';
    if (RENDER_SECRET_SINGLE_KEYS.includes(key as (typeof RENDER_SECRET_SINGLE_KEYS)[number])) {
      if (!FORCE_OVERRIDE_FROM_SECRETS.has(key) && !shouldOverrideEnv(key, trimmed)) continue;
      process.env[key] = trimmed;
      console.error(`[cop-nest-api] Loaded secret file ${filePath}`);
    }
  }

  logRenderSecretsMountDiagnostic();
}

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
  const b64 = (process.env.COP_PRODUCTION_ENV_B64 ?? '').trim();
  const parts = [
    `MONGODB_URL=${url ? (mongoUrlHasPlaceholder(url) ? 'placeholder' : 'ok') : 'missing'}`,
    `DATABASE_URL=${dbUrl.startsWith('mongodb') ? (mongoUrlHasPlaceholder(dbUrl) ? 'placeholder' : 'ok') : 'unset'}`,
    `MONGODB_PASSWORD=${pass ? `set(len=${pass.length})` : 'missing'}`,
    `REDIS_URL=${redisUrlStatus(resolveRedisUrl() || process.env.REDIS_URL)}`,
    `COP_PRODUCTION_ENV_B64=${b64 ? `set(len=${b64.length})` : 'unset'}`,
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

const REDIS_ENV_KEYS = ['REDIS_URL', 'REDIS_TLS_URL', 'UPSTASH_REDIS_URL'] as const;

/** Primera URI Redis usable (Render Key Value usa redis://red-...). */
export function resolveRedisUrl(): string {
  for (const key of REDIS_ENV_KEYS) {
    const normalized = normalizeRedisUrl(process.env[key]);
    if (!normalized) continue;
    const lower = normalized.toLowerCase();
    if (
      lower.includes('your-instance.upstash.io') ||
      lower.includes('your_upstash_token') ||
      lower.includes('example.upstash.io')
    ) {
      continue;
    }
    if (lower.startsWith('redis://') || lower.startsWith('rediss://')) {
      return normalized;
    }
  }
  return '';
}

/** Aplica normalización a process.env para que Config / ioredis reciban solo la URI. */
export function applyNormalizedRedisUrlFromEnv(): void {
  const resolved = resolveRedisUrl();
  if (resolved) {
    process.env.REDIS_URL = resolved;
  }
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
      'MongoDB: falta MONGODB_PASSWORD (o COP_PRODUCTION_ENV_B64). Ejecuta .\\deploy\\exportar-cop-production-env-b64.ps1 y pega en cop-nest-api → Environment.',
    );
  }

  const redis = resolveRedisUrl();
  if (!redis) {
    const raw = (process.env.REDIS_URL ?? '').trim();
    if (raw.includes('your-instance.upstash.io')) {
      errors.push(
        'REDIS_URL: borra la variable vieja con your-instance.upstash.io. Usa COP_PRODUCTION_ENV_B64 (deploy/exportar-cop-production-env-b64.ps1) o Sync Blueprint cop-redis.',
      );
    } else {
      errors.push(
        'REDIS_URL: vacía o inválida. Importa deploy/render-upload.env en Environment o Sync Blueprint (cop-redis).',
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
