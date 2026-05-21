/** Rutas que no deben llevar Authorization (evita 401 en login/refresh con token viejo). */
export function isAuthOrPublicRequest(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes('/public/') ||
    u.includes('/api/auth/login') ||
    u.includes('/api/auth/refresh') ||
    u.includes('/api/auth/register') ||
    u.includes('/api/auth/google') ||
    u.includes('/api/auth/setup-bootstrap') ||
    u.includes('/api/auth/ensure-bootstrap') ||
    u.includes('/api/auth/bootstrap-status') ||
    u.includes('/api/auth/login-help')
  );
}

export function decodeJwtExpMs(token: string): number | null {
  try {
    const base64Url = token.split('.')[1] ?? '';
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isAccessTokenUsable(token: string | null, skewMs = 30_000): boolean {
  if (!token || !token.includes('.')) return false;
  const expMs = decodeJwtExpMs(token);
  if (expMs == null) return false;
  return expMs > Date.now() + skewMs;
}
