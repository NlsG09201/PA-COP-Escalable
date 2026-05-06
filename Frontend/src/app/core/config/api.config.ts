function resolveApiBaseUrl(): string {
  const raw = (globalThis as { __env?: { API_BASE_URL?: string } }).__env?.API_BASE_URL;

  // Cadena vacía = mismo origen (dashboard nginx hace proxy a /api).
  if (raw === '') return '';

  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim().replace(/\/$/, '');
  }

  return 'http://localhost:8080';
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Para comparar/normalizar URLs (p. ej. GLB JWT) cuando el API va por proxy relativo (:5173 + /api).
 */
export function apiOriginForRequests(): string {
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
