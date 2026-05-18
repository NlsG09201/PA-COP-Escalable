const INSECURE_JWT_VALUES = new Set(['change_me', 'changeme', 'secret', '']);

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

  const cors = (process.env.CORS_ORIGINS ?? '').trim();
  if (!cors) {
    throw new Error(
      'CORS_ORIGINS must list allowed origins (comma-separated) when NODE_ENV=production',
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
