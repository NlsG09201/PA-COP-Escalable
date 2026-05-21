#!/usr/bin/env node
/**
 * Asigna roles SUPER_ADMIN + ADMIN a un usuario en MongoDB Atlas.
 *
 *   node scripts/asignar-rol-admin.mjs
 *   node scripts/asignar-rol-admin.mjs --user nelsonherazoi
 *   node scripts/asignar-rol-admin.mjs --uri "mongodb+srv://..."
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadDotEnv() {
  const path = resolve(root, '.env');
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return env;
}

function parseArgs(argv) {
  const out = { user: '', uri: '' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--user' && argv[i + 1]) out.user = argv[++i].trim().toLowerCase();
    else if (argv[i] === '--uri' && argv[i + 1]) out.uri = argv[++i];
  }
  return out;
}

function resolveUri(env, cliUri) {
  let url = cliUri?.trim() || env.MONGODB_ATLAS_URI || env.MONGODB_URL || '';
  if (url.includes('<db_password>') && env.MONGODB_PASSWORD) {
    const user = env.MONGODB_USER || 'nelsonherazoi';
    const host = env.MONGODB_HOST || 'cluster0.6oyhyja.mongodb.net';
    const db = env.MONGODB_DB || 'cop';
    url = `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(env.MONGODB_PASSWORD)}@${host}/${db}?retryWrites=true&w=majority&appName=Cluster0`;
  }
  if (!url.startsWith('mongodb')) throw new Error('Falta MONGODB_URL en .env o --uri');
  return url;
}

async function main() {
  const opts = parseArgs(process.argv);
  const env = loadDotEnv();
  const username = opts.user || env.APP_BOOTSTRAP_ADMIN_USERNAME || 'nelsonherazoi';
  const uri = resolveUri(env, opts.uri);

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 60_000 });
  await client.connect();

  const dbName = (() => {
    try {
      const n = uri.replace(/^mongodb\+srv:/, 'mongodb:').replace(/^mongodb:/, 'http:');
      const p = new URL(n).pathname.replace(/^\//, '').split('/')[0];
      return p || env.MONGODB_DB || 'cop';
    } catch {
      return env.MONGODB_DB || 'cop';
    }
  })();

  const db = client.db(dbName);
  const col = db.collection('users');

  const existing = await col.findOne({ username });
  if (!existing) {
    console.error(`[admin] No existe usuario "${username}" en ${dbName}.users`);
    console.error('  Ejecuta antes: .\\deploy\\subir-colecciones-atlas.ps1 -SoloAdmin');
    await client.close();
    process.exit(1);
  }

  const before = Array.isArray(existing.roles) ? existing.roles : [];
  const merged = [...new Set([...before, ...ADMIN_ROLES])];

  await col.updateOne(
    { username },
    {
      $set: {
        roles: merged,
        updatedAt: new Date(),
      },
    },
  );

  console.log(`[admin] Usuario: ${username}`);
  console.log(`[admin] Roles antes: ${before.join(', ') || '(ninguno)'}`);
  console.log(`[admin] Roles ahora:  ${merged.join(', ')}`);
  console.log('[admin] Puede entrar al panel clínico (Frontend) con ADMIN / SUPER_ADMIN.');

  await client.close();
}

main().catch((err) => {
  console.error('[admin] Error:', err.message || err);
  process.exit(1);
});
