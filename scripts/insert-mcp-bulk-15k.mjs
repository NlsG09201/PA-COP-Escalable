#!/usr/bin/env node
/**
 * Inserta lotes generados por generate-mcp-bulk-15k.mjs en Atlas.
 * Misma estructura que insert-many del MCP MongoDB.
 *
 *   node scripts/insert-mcp-bulk-15k.mjs
 *   node scripts/insert-mcp-bulk-15k.mjs --forzar
 */
import dns from 'node:dns';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

/** DNS local a veces bloquea SRV de Atlas; usar resolvers públicos. */
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

async function insertBatches(db, prefix, collection) {
  const files = readdirSync(bulkDir)
    .filter((f) => f.startsWith(`${prefix}-batch-`) && f.endsWith('.json'))
    .sort();
  let total = 0;
  for (const file of files) {
    const docs = JSON.parse(readFileSync(join(bulkDir, file), 'utf8'));
    if (!docs.length) continue;
    const res = await db.collection(collection).insertMany(docs, { ordered: false });
    total += res.insertedCount;
    process.stdout.write(`\r[insert] ${collection}: ${total} (${file})`);
  }
  console.log('');
  return total;
}

async function main() {
  const forzar = process.argv.includes('--forzar');
  const env = loadDotEnv();
  const uri = resolveUri(env);
  const dbName = env.MONGODB_DB || 'cop';

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 90_000 });
  await client.connect();
  const db = client.db(dbName);

  if (forzar) {
    const d1 = await db.collection('patients').deleteMany({ ingest_source: MARKER });
    const d2 = await db.collection('j48_predictions').deleteMany({ ingest_source: MARKER });
    console.log(`[insert] Limpiados: patients=${d1.deletedCount}, j48=${d2.deletedCount}`);
  }

  const beforeP = await db.collection('patients').countDocuments();
  const beforeJ = await db.collection('j48_predictions').countDocuments();

  const pIns = await insertBatches(db, 'patients', 'patients');
  const jIns = await insertBatches(db, 'j48_predictions', 'j48_predictions');

  const afterP = await db.collection('patients').countDocuments();
  const afterJ = await db.collection('j48_predictions').countDocuments();

  console.log(`[insert] patients: +${pIns} (total ${afterP}, antes ${beforeP})`);
  console.log(`[insert] j48_predictions: +${jIns} (total ${afterJ}, antes ${beforeJ})`);

  await client.close();
}

main().catch((err) => {
  console.error('[insert] Error:', err.message || err);
  process.exit(1);
});
