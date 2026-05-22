#!/usr/bin/env node
/**
 * Inserta catálogo COP en Atlas (lee deploy/mcp-payloads/*.json).
 *   node scripts/generate-catalog-mcp-payloads.mjs
 *   node scripts/insert-catalog-atlas.mjs
 *   node scripts/insert-catalog-atlas.mjs --forzar
 */
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const payloadDir = resolve(root, 'deploy/mcp-payloads');
const MARKER = 'mcp-bulk-35k';
const BATCH = 200;

function loadEnv() {
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

function loadJson(name) {
  const p = resolve(payloadDir, name);
  if (!existsSync(p)) throw new Error(`Falta ${p}. Ejecuta generate-catalog-mcp-payloads.mjs`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

async function main() {
  const forzar = process.argv.includes('--forzar');
  const env = loadEnv();
  const uri = env.MONGODB_URL || env.MONGODB_ATLAS_URI;
  if (!uri?.startsWith('mongodb')) throw new Error('Falta MONGODB_URL en .env');

  const categories = loadJson('service_categories.json');
  const catalogServices = loadJson('catalog_services.json');
  const offerings = loadJson('service_offerings.json');

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 90_000 });
  console.log('[catalog] Conectando Atlas...');
  await client.connect();
  const db = client.db();

  try {
    if (forzar) {
      const o = await db.collection('service_offerings').deleteMany({ ingest_source: MARKER });
      const c = await db.collection('catalog_services').deleteMany({ ingest_source: MARKER });
      const cat = await db.collection('service_categories').deleteMany({ ingest_source: MARKER });
      console.log(`[catalog] Limpiado marker: offerings=${o.deletedCount} catalog=${c.deletedCount} categories=${cat.deletedCount}`);
    } else {
      const n = await db.collection('service_offerings').countDocuments({ ingest_source: MARKER, visible_public: true });
      if (n >= offerings.length * 0.9) {
        console.log(`[catalog] Ya hay ${n} offerings públicos (${MARKER}); omitiendo.`);
        return;
      }
    }

    await db.collection('service_categories').insertMany(categories, { ordered: false });
    console.log(`[catalog] +${categories.length} categorías`);

    await db.collection('catalog_services').insertMany(catalogServices, { ordered: false });
    console.log(`[catalog] +${catalogServices.length} catalog_services`);

    let inserted = 0;
    for (let i = 0; i < offerings.length; i += BATCH) {
      const chunk = offerings.slice(i, i + BATCH);
      const res = await db.collection('service_offerings').insertMany(chunk, { ordered: false });
      inserted += res.insertedCount;
      console.log(`[catalog] offerings lote ${Math.floor(i / BATCH) + 1}: +${res.insertedCount}`);
    }

    const pub = await db.collection('service_offerings').countDocuments({ visible_public: true });
    console.log(`[catalog] OK. offerings visible_public total en DB: ${pub}`);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
