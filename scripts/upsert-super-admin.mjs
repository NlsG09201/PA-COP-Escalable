#!/usr/bin/env node
/**
 * Crea o resetea un usuario SUPER_ADMIN + ADMIN en MongoDB Atlas.
 *
 *   node scripts/upsert-super-admin.mjs
 *   node scripts/upsert-super-admin.mjs --user GM140810 --email Odontologuito@gmail.com --password GM148Odonto
 */
import { existsSync, readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const bcrypt = require(resolve(root, 'nest-migration/node_modules/bcrypt'));

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
  const out = { user: '', email: '', password: '', uri: '', orgId: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === '--user' && next) out.user = argv[++i].trim();
    else if (key === '--email' && next) out.email = argv[++i].trim();
    else if (key === '--password' && next) out.password = argv[++i];
    else if (key === '--uri' && next) out.uri = argv[++i];
    else if (key === '--org-id' && next) out.orgId = argv[++i].trim();
  }
  return out;
}

function resolveUri(env, cliUri) {
  let url = cliUri?.trim() || env.MONGODB_ATLAS_URI || env.MONGODB_URL || '';
  if (url.includes('<db_password>') && env.MONGODB_PASSWORD) {
    const user = env.MONGODB_USER || 'nelsonherazoi';
    const host = env.MONGODB_HOST || 'cluster0.5dduzba.mongodb.net';
    const db = env.MONGODB_DB || 'cop';
    const query = env.MONGODB_OPTIONS || 'retryWrites=true&w=majority&appName=Cluster0';
    url = `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(env.MONGODB_PASSWORD)}@${host}/${db}?${query}`;
  }
  if (!url.startsWith('mongodb')) throw new Error('Falta MONGODB_URL en .env o --uri');
  return url;
}

function dbNameFromUri(uri, env) {
  try {
    const normalized = uri.replace(/^mongodb\+srv:/, 'mongodb:').replace(/^mongodb:/, 'http:');
    const db = new URL(normalized).pathname.replace(/^\//, '').split('/')[0];
    return db || env.MONGODB_DB || 'cop';
  } catch {
    return env.MONGODB_DB || 'cop';
  }
}

function usernameRegex(username) {
  return new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
}

async function main() {
  const opts = parseArgs(process.argv);
  const env = loadDotEnv();
  const username = (opts.user || env.APP_BOOTSTRAP_ADMIN_USERNAME || 'GM140810').trim();
  const email = (opts.email || env.APP_BOOTSTRAP_ADMIN_EMAIL || 'Odontologuito@gmail.com').trim().toLowerCase();
  const password = opts.password || env.APP_BOOTSTRAP_ADMIN_PASSWORD;
  const orgId = (opts.orgId || env.APP_BOOTSTRAP_ADMIN_ORG_ID || 'be7f4015-67ad-472b-9cf7-aadcd8b0d604').trim();

  if (!username) throw new Error('Falta --user o APP_BOOTSTRAP_ADMIN_USERNAME');
  if (!password || password.length < 8) throw new Error('Falta password de al menos 8 caracteres');
  if (!orgId) throw new Error('Falta --org-id o APP_BOOTSTRAP_ADMIN_ORG_ID');

  const uri = resolveUri(env, opts.uri);
  const dbName = dbNameFromUri(uri, env);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 60_000 });
  await client.connect();

  const col = client.db(dbName).collection('users');
  const filter = { $or: [{ username: usernameRegex(username) }, { email: usernameRegex(email) }] };
  const existing = await col.findOne(filter);
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const keepId = existing?._id ?? crypto.randomUUID();

  await col.deleteMany(filter);
  await col.insertOne({
    _id: keepId,
    organization_id: orgId,
    username,
    email,
    password_hash: passwordHash,
    roles: ADMIN_ROLES,
    mfa_enabled: false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  console.log(`[admin] Usuario ${existing ? 'actualizado' : 'creado'}: ${username}`);
  console.log(`[admin] Email: ${email}`);
  console.log(`[admin] Roles: ${ADMIN_ROLES.join(', ')}`);
  console.log(`[admin] DB: ${dbName}.users`);

  await client.close();
}

main().catch((err) => {
  console.error('[admin] Error:', err.message || err);
  process.exit(1);
});
