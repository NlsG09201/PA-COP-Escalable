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

  if (raw === '') return isVercelHost() ? VERCEL_API_PROXY : '';

  if (isVercelHost()) return VERCEL_API_PROXY;

  return 'http://localhost:8080';
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Para comparar/normalizar URLs (p. ej. GLB JWT) cuando el API va por proxy relativo (:5173 + /api).
 */
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

const OUR_ORTHO_GLB_PATH_RE = /^\/api\/ortho\/3d\/jobs\/[^/]+\/glb$/;

/**
 * El backend a veces guarda `glbUrl` con host equivocado (p. ej. `http://localhost/...` sin puerto).
 * Si es nuestro GLB con JWT, fuerza el origen del cliente para evitar ERR_CONNECTION_REFUSED.
 */
export function normalizeInternalGlbDownloadUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;

  let pathname: string;
  let search: string;

  if (t.startsWith('http://') || t.startsWith('https://')) {
    try {
      const u = new URL(t);
      pathname = u.pathname;
      search = u.search;
    } catch {
      return t;
    }
  } else {
    pathname = t.startsWith('/') ? t : `/${t}`;
    search = '';
  }

  const isOurGlb = OUR_ORTHO_GLB_PATH_RE.test(pathname);
  if (!isOurGlb) {
    if (t.startsWith('http://') || t.startsWith('https://')) return t;
    const origin = apiOriginForRequests().replace(/\/$/, '');
    return `${origin}${pathname}${search}`;
  }

  // Ruta absoluta en el documento: evita `http://localhost` (puerto 80) cuando el SPA está en :5173.
  return `${pathname}${search}`;
}

/** Resuelve URL absoluta para comparar orígenes (HttpClient/fetch aceptan path relativo al documento). */
export function resolveUrlAgainstApiOrigin(url: string): URL {
  const base = apiOriginForRequests().replace(/\/$/, '');
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return new URL(url);
  }
  return new URL(url.startsWith('/') ? url : `/${url}`, `${base}/`);
}

/** URL lista para HttpClient cuando `API_BASE_URL` apunta al API pero el SPA corre en otro origen (p. ej. ng serve). */
export function resolveHttpRequestUrl(url: string): string {
  try {
    return resolveUrlAgainstApiOrigin(url).href;
  } catch {
    return url;
  }
}
