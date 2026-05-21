#!/usr/bin/env node
/**
 * Genera public/env.js y vercel.json antes del build en Vercel.
 *
 * Variables (Vercel → Settings → Environment Variables, Production):
 *   RENDER_API_HOST  — ej. pa-cop-escalable.onrender.com (sin https://)
 *   API_BASE_URL     — opcional; en Vercel se usa proxy /render-api si VERCEL_API_PROXY≠false
 *   PUBLIC_SITE_URL  — opcional; si falta, se usa https://VERCEL_URL
 *   DASHBOARD_URL    — opcional (omitir placeholders your-*.vercel.app)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_PROXY_PREFIX = '/render-api';

const app = process.argv[2];
if (!app || !['PublicWeb', 'Frontend'].includes(app)) {
  console.error('Uso: node scripts/prepare-vercel.mjs <PublicWeb|Frontend>');
  process.exit(1);
}

function isPlaceholderUrl(value) {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return true;
  return v.includes('your-') || v.includes('your_') || v.includes('placeholder');
}

const rawHost =
  process.env.RENDER_API_HOST ??
  process.env.RENDER_API_URL ??
  process.env.PUBLIC_API_ORIGIN ??
  '';

const host = rawHost
  .trim()
  .replace(/^https?:\/\//i, '')
  .replace(/\/$/, '');

let renderApiUrl = (process.env.API_BASE_URL ?? '').trim().replace(/\/$/, '');
if (!renderApiUrl && host) {
  renderApiUrl = `https://${host}`;
}

if (!renderApiUrl || renderApiUrl.includes('YOUR_RENDER') || host.includes('YOUR_RENDER')) {
  console.error(`
[prepare-vercel] Falta la URL del API en Vercel.

  Settings → Environment Variables → Production:
    RENDER_API_HOST = pa-cop-escalable.onrender.com

  Root Directory: PublicWeb o Frontend (no la raíz del repo).
  Luego: Deployments → Redeploy.
`);
  process.exit(1);
}

const onVercel = process.env.VERCEL === '1';
const useApiProxy =
  onVercel && (process.env.VERCEL_API_PROXY ?? 'true').trim().toLowerCase() !== 'false';

const clientApiBase = useApiProxy ? API_PROXY_PREFIX : renderApiUrl;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(repoRoot, app);

const vercelHost = (process.env.VERCEL_URL ?? '').trim().replace(/^https?:\/\//i, '');
const vercelPublicFromEnv = (process.env.VERCEL_PUBLIC_WEB_URL ?? '').trim();
const defaultPublicSite =
  app === 'PublicWeb' && vercelHost ? `https://${vercelHost}` : '';

let publicSiteUrl = (process.env.PUBLIC_SITE_URL ?? '').trim() || defaultPublicSite;
if (isPlaceholderUrl(publicSiteUrl)) {
  publicSiteUrl = defaultPublicSite || vercelPublicFromEnv;
}

let dashboardUrl = (process.env.DASHBOARD_URL ?? '').trim();
if (isPlaceholderUrl(dashboardUrl)) {
  dashboardUrl = '';
}

const envLines = [
  'window.__env = window.__env || {};',
  `window.__env.API_BASE_URL = ${JSON.stringify(clientApiBase)};`,
];
if (dashboardUrl) {
  envLines.push(`window.__env.DASHBOARD_URL = ${JSON.stringify(dashboardUrl)};`);
}
if (publicSiteUrl) {
  envLines.push(`window.__env.PUBLIC_SITE_URL = ${JSON.stringify(publicSiteUrl)};`);
}

fs.writeFileSync(path.join(appDir, 'public', 'env.js'), `${envLines.join('\n')}\n`, 'utf8');

const outputDirectory =
  app === 'PublicWeb' ? 'dist/PublicWeb/browser' : 'dist/Frontend/browser';

const installCommand = `node ../scripts/prepare-vercel.mjs ${app} && npm ci`;

const rewrites = [];
if (useApiProxy) {
  rewrites.push({
    source: `${API_PROXY_PREFIX}/:path*`,
    destination: `${renderApiUrl}/:path*`,
  });
}
// Solo rutas HTML → index.html. Evita servir index.html para .js/.css (MIME error en chunks lazy).
rewrites.push({
  source: '/:path*',
  has: [{ type: 'header', key: 'accept', value: 'text/html' }],
  destination: '/index.html',
});

const vercel = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: null,
  installCommand,
  buildCommand: 'ng build',
  outputDirectory,
  rewrites,
  headers: [
    {
      source: '/env.js',
      headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
    },
    {
      source: '/index.html',
      headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
    },
    {
      source: '/',
      headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
    },
    {
      source: '/main-*.js',
      headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
    },
    {
      source: '/chunk-*.js',
      headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
    },
    {
      source: '/:path*.js',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
    },
    {
      source: '/:path*.css',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
  ],
};

fs.writeFileSync(path.join(appDir, 'vercel.json'), `${JSON.stringify(vercel, null, 2)}\n`, 'utf8');

const mode = useApiProxy ? `proxy ${API_PROXY_PREFIX} → ${renderApiUrl}` : `direct ${clientApiBase}`;
console.log(`[prepare-vercel] ${app}: ${mode}`);
