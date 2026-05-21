#!/usr/bin/env node
/**
 * Inserta lotes deploy/mcp-payloads/bulk/* via driver MongoDB (mismo contenido que MCP insert-many).
 *   node scripts/mcp-insert-bulk-batches.mjs --forzar
 */
import dns from 'node:dns';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const bulkDir = resolve(root, 'deploy/mcp-payloads/bulk');
const MARKER = 'mcp-bulk-15k';

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

function resolveUri(env) {
  let url = env.MONGODB_ATLAS_URI || env.MONGODB_URL || '';
  if (url.includes('<db_password>') && env.MONGODB_PASSWORD) {
    const user = env.MONGODB_USER || 'nelsonherazoi';
    const host = env.MONGODB_HOST || 'cluster0.5dduzba.mongodb.net';
    const db = env.MONGODB_DB || 'cop';
    url = `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(env.MONGODB_PASSWORD)}@${host}/${db}?retryWrites=true&w=majority&appName=Cluster0`;
  }
  if (!url.startsWith('mongodb')) throw new Error('Falta MONGODB_URL en .env');
  return url;
}

async function insertPrefix(db, prefix, collection) {
  const files = readdirSync(bulkDir)
    .filter((f) => f.startsWith(`${prefix}-batch-`) && f.endsWith('.json'))
    .sort();
  let total = 0;
  for (const file of files) {
    const docs = JSON.parse(readFileSync(join(bulkDir, file), 'utf8'));
    const res = await db.collection(collection).insertMany(docs, { ordered: false });
    total += res.insertedCount;
    process.stdout.write(`\r[mcp-bulk] ${collection}: ${total}`);
  }
  console.log('');
  return total;
}

async function main() {
  const forzar = process.argv.includes('--forzar');
  const env = loadDotEnv();
  const client = new MongoClient(resolveUri(env), { serverSelectionTimeoutMS: 90_000 });
  await client.connect();
  const db = client.db(env.MONGODB_DB || 'cop');

  if (forzar) {
    await db.collection('patients').deleteMany({ ingest_source: MARKER });
    await db.collection('j48_predictions').deleteMany({ ingest_source: MARKER });
  }

  const p = await insertPrefix(db, 'patients', 'patients');
  const j = await insertPrefix(db, 'j48_predictions', 'j48_predictions');
  console.log(`[mcp-bulk] OK patients=${p} j48=${j}`);
  await client.close();
}

main().catch((e) => {
  console.error('[mcp-bulk]', e.message || e);
  process.exit(1);
});
