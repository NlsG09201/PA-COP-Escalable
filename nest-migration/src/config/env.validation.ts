const INSECURE_JWT_VALUES = new Set(['change_me', 'changeme', 'secret', '']);

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

  const mongo = (process.env.MONGODB_URL ?? '').trim();
  if (!mongo) {
    throw new Error('MONGODB_URL is required when NODE_ENV=production');
  }

  const redis = (process.env.REDIS_URL ?? '').trim();
  if (!redis) {
    throw new Error('REDIS_URL is required when NODE_ENV=production');
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
