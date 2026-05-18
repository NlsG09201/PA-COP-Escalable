#!/usr/bin/env node
/**
 * Genera public/env.js y vercel.json antes del build en Vercel.
 *
 * Variables (Vercel → Settings → Environment Variables):
 *   RENDER_API_HOST  — ej. cop-nest-api.onrender.com (sin https://)
 *   DASHBOARD_URL    — opcional, URL del panel en Vercel
 *   PUBLIC_SITE_URL  — opcional, URL de la web pública
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = process.argv[2];
if (!app || !['PublicWeb', 'Frontend'].includes(app)) {
  console.error('Uso: node scripts/prepare-vercel.mjs <PublicWeb|Frontend>');
  process.exit(1);
}

const host = (process.env.RENDER_API_HOST ?? '')
  .trim()
  .replace(/^https?:\/\//i, '')
  .replace(/\/$/, '');

if (!host) {
  console.error('Falta RENDER_API_HOST (ej. cop-nest-api.onrender.com)');
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(repoRoot, app);
const apiBaseUrl = process.env.API_BASE_URL ?? '';

const envLines = ['window.__env = window.__env || {};', `window.__env.API_BASE_URL = ${JSON.stringify(apiBaseUrl)};`];
if (process.env.DASHBOARD_URL) {
  envLines.push(`window.__env.DASHBOARD_URL = ${JSON.stringify(process.env.DASHBOARD_URL)};`);
}
if (process.env.PUBLIC_SITE_URL) {
  envLines.push(`window.__env.PUBLIC_SITE_URL = ${JSON.stringify(process.env.PUBLIC_SITE_URL)};`);
}

fs.writeFileSync(path.join(appDir, 'public', 'env.js'), `${envLines.join('\n')}\n`, 'utf8');

const outputDirectory =
  app === 'PublicWeb' ? 'dist/PublicWeb/browser' : 'dist/Frontend/browser';

const vercel = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: null,
  installCommand: 'npm ci',
  buildCommand: `node ../scripts/prepare-vercel.mjs ${app} && npm ci && npm run build`,
  outputDirectory,
  rewrites: [
    { source: '/api/(.*)', destination: `https://${host}/api/$1` },
    { source: '/public/(.*)', destination: `https://${host}/public/$1` },
    { source: '/(.*)', destination: '/index.html' },
  ],
  headers: [
    {
      source: '/env.js',
      headers: [{ key: 'Cache-Control', value: 'no-cache' }],
    },
  ],
};

if (app === 'Frontend') {
  vercel.rewrites.splice(2, 0, {
    source: '/ortho-ai/(.*)',
    destination: `https://${host}/ortho-ai/$1`,
  });
}

fs.writeFileSync(path.join(appDir, 'vercel.json'), `${JSON.stringify(vercel, null, 2)}\n`, 'utf8');
console.log(`[prepare-vercel] ${app}: env.js + vercel.json → API proxy https://${host}`);
