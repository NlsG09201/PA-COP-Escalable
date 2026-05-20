#!/usr/bin/env node
/**
 * Genera public/env.js y vercel.json antes del build en Vercel.
 *
 * Variables (Vercel → Settings → Environment Variables, Production):
 *   RENDER_API_HOST  — ej. cop-nest-api.onrender.com (sin https://)
 *   API_BASE_URL     — opcional; si falta, se usa https://RENDER_API_HOST
 *   DASHBOARD_URL    — opcional
 *   PUBLIC_SITE_URL  — opcional
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = process.argv[2];
if (!app || !['PublicWeb', 'Frontend'].includes(app)) {
  console.error('Uso: node scripts/prepare-vercel.mjs <PublicWeb|Frontend>');
  process.exit(1);
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

let apiBaseUrl = (process.env.API_BASE_URL ?? '').trim().replace(/\/$/, '');
if (!apiBaseUrl && host) {
  apiBaseUrl = `https://${host}`;
}

if (!apiBaseUrl || apiBaseUrl.includes('YOUR_RENDER') || host.includes('YOUR_RENDER')) {
  console.error(`
[prepare-vercel] Falta la URL del API en Vercel.

  Settings → Environment Variables → Production (marca Production):
    RENDER_API_HOST = cop-nest-api.onrender.com

  (sin https://, sin rutas; usa el host real de tu servicio en Render)

  Opcional: API_BASE_URL = https://cop-nest-api.onrender.com

  Root Directory del proyecto: PublicWeb o Frontend (no la raíz del repo).
  Luego: Deployments → Redeploy (sin cache si puedes).
`);
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(repoRoot, app);

const envLines = [
  'window.__env = window.__env || {};',
  `window.__env.API_BASE_URL = ${JSON.stringify(apiBaseUrl)};`,
];
if (process.env.DASHBOARD_URL) {
  envLines.push(`window.__env.DASHBOARD_URL = ${JSON.stringify(process.env.DASHBOARD_URL)};`);
}
if (process.env.PUBLIC_SITE_URL) {
  envLines.push(`window.__env.PUBLIC_SITE_URL = ${JSON.stringify(process.env.PUBLIC_SITE_URL)};`);
}

fs.writeFileSync(path.join(appDir, 'public', 'env.js'), `${envLines.join('\n')}\n`, 'utf8');

const outputDirectory =
  app === 'PublicWeb' ? 'dist/PublicWeb/browser' : 'dist/Frontend/browser';

const installCommand = `node ../scripts/prepare-vercel.mjs ${app} && npm ci`;

/** Solo SPA; el API se llama por URL absoluta en env.js (evita rewrites rotos a YOUR_RENDER_API_HOST). */
const vercel = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: null,
  installCommand,
  buildCommand: 'ng build',
  outputDirectory,
  rewrites: [{ source: '/(.*)', destination: '/index.html' }],
  headers: [
    {
      source: '/env.js',
      headers: [{ key: 'Cache-Control', value: 'no-cache' }],
    },
  ],
};

fs.writeFileSync(path.join(appDir, 'vercel.json'), `${JSON.stringify(vercel, null, 2)}\n`, 'utf8');
console.log(`[prepare-vercel] ${app}: API_BASE_URL=${apiBaseUrl} (env.js + vercel.json SPA)`);
