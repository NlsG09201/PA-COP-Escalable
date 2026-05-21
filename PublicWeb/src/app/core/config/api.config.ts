/** Proxy same-origin en Vercel (vercel.json → Render). Evita CORS en el navegador. */
const VERCEL_API_PROXY = '/render-api';

const DEFAULT_RENDER_API = 'https://pa-cop-escalable.onrender.com';

function isVercelHost(): boolean {
  return typeof window !== 'undefined' && /\.vercel\.app$/i.test(window.location.hostname);
}

function resolveApiBaseUrl(): string {
  const raw = (globalThis as { __env?: { API_BASE_URL?: string } }).__env?.API_BASE_URL;

  if (typeof raw === 'string' && raw.trim() !== '') {
    const v = raw.trim().replace(/\/$/, '');
    if (v.startsWith('/')) return v;
    return v;
  }

  // env.js con "" = proxy nginx local (Docker).
  if (raw === '') {
    return isVercelHost() ? VERCEL_API_PROXY : '';
  }

  if (isVercelHost()) return VERCEL_API_PROXY;

  return 'http://localhost:8080';
}

export const API_BASE_URL = resolveApiBaseUrl();

/** Origen para URLs relativas al API (p. ej. descargas con JWT). */
export function apiOriginForRequests(): string {
  if (API_BASE_URL.startsWith('/') && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${API_BASE_URL}`.replace(/\/$/, '');
  }
  if (API_BASE_URL !== '') return API_BASE_URL.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return 'http://localhost:8080';
}
