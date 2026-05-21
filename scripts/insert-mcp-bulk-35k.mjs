#!/usr/bin/env node
/**
 * Inserta lotes bulk-35k en Atlas (misma operación que insert-many MCP).
 *
 *   node scripts/insert-mcp-bulk-35k.mjs
 *   node scripts/insert-mcp-bulk-35k.mjs --forzar
 */
import dns from 'node:dns';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const bulkDir = resolve(root, 'deploy/mcp-payloads/bulk-35k');
const MARKER = 'mcp-bulk-35k';

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

async function insertPatientBatches(db) {
  const files = readdirSync(bulkDir)
    .filter((f) => f.startsWith('patients-batch-') && f.endsWith('.json'))
    .sort();
  let total = 0;
  for (const file of files) {
    const docs = JSON.parse(readFileSync(join(bulkDir, file), 'utf8'));
    const res = await db.collection('patients').insertMany(docs, { ordered: false });
    total += res.insertedCount;
    process.stdout.write(`\r[35k] patients: ${total} (${file})`);
  }
  console.log('');
  return total;
}

async function main() {
  const forzar = process.argv.includes('--forzar');
  const env = loadDotEnv();
  const uri = resolveUri(env);
  const dbName = env.MONGODB_DB || 'cop';

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 120_000 });
  console.log('[35k] Conectando...');
  await client.connect();
  const db = client.db(dbName);

  try {
    if (forzar) {
      const d = await db.collection('patients').deleteMany({ ingest_source: MARKER });
      console.log(`[35k] Eliminados ${d.deletedCount} pacientes (${MARKER})`);
    }

    const existing = await db.collection('patients').countDocuments({ ingest_source: MARKER });
    if (existing >= 35000 && !forzar) {
      console.log(`[35k] Ya existen ${existing} pacientes con ${MARKER}`);
    } else {
      const inserted = await insertPatientBatches(db);
      const odonto = await db.collection('patients').countDocuments({
        ingest_source: MARKER,
        clinical_area: 'ODONTOLOGIA',
      });
      const psico = await db.collection('patients').countDocuments({
        ingest_source: MARKER,
        clinical_area: 'PSICOLOGIA',
      });
      console.log(`[35k] Insertados ${inserted} | odonto=${odonto} psico=${psico}`);
    }

    console.log('[35k] Cargando catálogo de servicios...');
    const { spawn } = await import('node:child_process');
    await new Promise((resolvePromise, reject) => {
      const child = spawn(process.execPath, [resolve(root, 'scripts/seed-atlas-35k-catalog.mjs'), '--solo-catalogo'], {
        stdio: 'inherit',
        cwd: root,
      });
      child.on('exit', (code) => (code === 0 ? resolvePromise() : reject(new Error(`catalog exit ${code}`))));
    });
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
