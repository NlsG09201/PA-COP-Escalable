/** Host del API Nest en Render (sin https). Ajusta en Vercel con RENDER_API_HOST si cambia el servicio. */
const DEFAULT_RENDER_API = 'https://cop-nest-api.onrender.com';

function isVercelHost(): boolean {
  return typeof window !== 'undefined' && /\.vercel\.app$/i.test(window.location.hostname);
}

function resolveApiBaseUrl(): string {
  const raw = (globalThis as { __env?: { API_BASE_URL?: string } }).__env?.API_BASE_URL;

  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim().replace(/\/$/, '');
  }

  // env.js con "" = proxy nginx local (Docker). En Vercel eso rompe (/public → 502).
  if (raw === '') {
    return isVercelHost() ? DEFAULT_RENDER_API : '';
  }

  return 'http://localhost:8080';
}

export const API_BASE_URL = resolveApiBaseUrl();

/** Origen para URLs relativas al API (p. ej. descargas con JWT). */
export function apiOriginForRequests(): string {
  if (API_BASE_URL !== '') return API_BASE_URL.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return 'http://localhost:8080';
}
