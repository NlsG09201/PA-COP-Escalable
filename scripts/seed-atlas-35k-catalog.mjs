#!/usr/bin/env node
/**
 * Carga 35.000 pacientes (17.5k odontología + 17.5k psicología) y catálogo de servicios con precios.
 *
 *   node scripts/seed-atlas-35k-catalog.mjs
 *   node scripts/seed-atlas-35k-catalog.mjs --forzar
 *   node scripts/seed-atlas-35k-catalog.mjs --solo-catalogo
 *   node scripts/seed-atlas-35k-catalog.mjs --solo-pacientes
 */
import dns from 'node:dns';
import { readFileSync, existsSync } from 'node:fs';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { MongoClient, UUID } from 'mongodb';
import { COLOMBIA_SITES_CATALOG } from './colombia-sites-catalog.mjs';
import { COP_SERVICE_CATALOG } from './cop-service-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const TARGET_PER_AREA = 17_500;
const TARGET_TOTAL = 35_000;
const BATCH = 500;
const MARKER = 'mcp-bulk-35k';
const ORG_ID = process.env.APP_BOOTSTRAP_ADMIN_ORG_ID || 'be7f4015-67ad-472b-9cf7-aadcd8b0d604';

function parseArgs(argv) {
  return {
    forzar: argv.includes('--forzar'),
    soloCatalogo: argv.includes('--solo-catalogo'),
    soloPacientes: argv.includes('--solo-pacientes'),
  };
}

function loadDotEnv() {
  const path = resolve(root, '.env');
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
  return env;
}

function resolveMongoUri(env) {
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

function toUuid(value) {
  const s = String(value ?? '').trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return new UUID(s);
  }
  return new UUID();
}

function normDept(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

function birthDateFromAge(edad) {
  const age = Math.min(100, Math.max(0, edad));
  const y = new Date().getFullYear() - age;
  return new Date(`${y}-06-15T12:00:00.000Z`);
}

function genderFromRaw(g) {
  const s = String(g ?? '').trim().toUpperCase();
  if (s.startsWith('F')) return 'F';
  if (s.startsWith('M')) return 'M';
  return 'O';
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 64);
}

async function loadSiteByDept(db, orgId) {
  const col = db.collection('sites');
  const orgUuid = toUuid(orgId);
  const sites = await col
    .find({
      status: 'ACTIVE',
      $or: [{ organization_id: orgId }, { organization_id: orgUuid }],
    })
    .toArray();
  const siteByDept = new Map();
  for (const s of sites) {
    const id = typeof s._id?.toString === 'function' ? s._id.toString() : String(s._id);
    const key = normDept(String(s.department ?? ''));
    if (!siteByDept.has(key)) siteByDept.set(key, []);
    siteByDept.get(key).push({ _id: id, department: String(s.department) });
  }
  if (siteByDept.size > 0) return { siteByDept, sites };

  for (const row of COLOMBIA_SITES_CATALOG) {
    const key = normDept(row.department);
    if (!siteByDept.has(key)) siteByDept.set(key, []);
    siteByDept.get(key).push({ _id: randomUUID(), department: row.department });
  }
  return { siteByDept, sites: [] };
}

function resolveSite(dept, siteByDept) {
  const key = normDept(dept);
  const aliases = { bogota: 'Bogotá D.C.', valle: 'Valle del Cauca' };
  const canonical = aliases[key] || dept?.trim();
  const list = siteByDept.get(normDept(canonical));
  if (list?.length) return list[Math.floor(Math.random() * list.length)];
  const all = [...siteByDept.values()].flat();
  return all[Math.floor(Math.random() * all.length)];
}

function buildPatient(area, index, orgId, siteByDept) {
  const prefix = area === 'ODONTOLOGIA' ? 'ODO' : 'PSI';
  const code = `P-${prefix}-${String(200000 + index)}`;
  const departments = [...new Set(COLOMBIA_SITES_CATALOG.map((s) => s.department))];
  const dept = departments[index % departments.length];
  const site = resolveSite(dept, siteByDept);
  const now = new Date();
  const edad = 1 + (index % 85);
  const motivos =
    area === 'ODONTOLOGIA'
      ? ['Consulta', 'Cirugía', 'Chequeo', 'Emergencia', 'Ortodoncia']
      : ['Consulta', 'Terapia', 'Evaluación', 'Crisis', 'Seguimiento'];

  return {
    _id: randomUUID(),
    organization_id: orgId,
    site_id: site?._id ?? null,
    external_code: code,
    full_name: `Paciente ${code}`,
    birth_date: birthDateFromAge(edad),
    gender: genderFromRaw(index % 2 === 0 ? 'F' : 'M'),
    phone: `+573${String(Math.abs(hashCode(code)) % 1_000_000_000).padStart(9, '0')}`,
    email: `paciente.${code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@cop-pacientes.local`,
    status: 'ACTIVE',
    clinical_area: area,
    ingest_source: MARKER,
    ingest_clinical_area: area,
    ingest_motivo: motivos[index % motivos.length],
    ingest_regimen: index % 3 === 0 ? 'Subsidiado' : 'Contributivo',
    created_at: now,
    updated_at: now,
  };
}

async function seedPatients(db, orgId, forzar) {
  const col = db.collection('patients');
  if (forzar) {
    const d = await col.deleteMany({ ingest_source: MARKER });
    console.log(`[35k] Eliminados ${d.deletedCount} pacientes (${MARKER})`);
  } else {
    const existing = await col.countDocuments({ ingest_source: MARKER });
    if (existing >= TARGET_TOTAL) {
      console.log(`[35k] Ya hay ${existing} pacientes con ${MARKER}; omitiendo.`);
      return { inserted: 0, skipped: true, total: existing };
    }
  }

  const { siteByDept } = await loadSiteByDept(db, orgId);
  const docs = [];
  for (let i = 1; i <= TARGET_PER_AREA; i++) {
    docs.push(buildPatient('ODONTOLOGIA', i, orgId, siteByDept));
  }
  for (let i = 1; i <= TARGET_PER_AREA; i++) {
    docs.push(buildPatient('PSICOLOGIA', i, orgId, siteByDept));
  }

  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const chunk = docs.slice(i, i + BATCH);
    const res = await col.insertMany(chunk, { ordered: false });
    inserted += res.insertedCount;
    console.log(`[35k] Pacientes lote ${Math.floor(i / BATCH) + 1}: +${res.insertedCount}`);
  }

  const odonto = await col.countDocuments({ ingest_source: MARKER, clinical_area: 'ODONTOLOGIA' });
  const psico = await col.countDocuments({ ingest_source: MARKER, clinical_area: 'PSICOLOGIA' });
  return { inserted, odonto, psico, total: odonto + psico };
}

async function seedServiceCatalog(db, orgId, forzar) {
  const orgUuid = toUuid(orgId);
  const catCol = db.collection('service_categories');
  const catalogCol = db.collection('catalog_services');
  const offeringCol = db.collection('service_offerings');

  if (forzar) {
    await offeringCol.deleteMany({ ingest_source: MARKER });
    await catalogCol.deleteMany({ ingest_source: MARKER });
    await catCol.deleteMany({ ingest_source: MARKER });
    console.log('[35k] Catálogo anterior (marker) eliminado');
  } else {
    const n = await catalogCol.countDocuments({ organization_id: orgUuid, ingest_source: MARKER });
    if (n >= COP_SERVICE_CATALOG.length) {
      console.log(`[35k] Catálogo ya cargado (${n} servicios); omitiendo.`);
      return { skipped: true, catalogCount: n };
    }
  }

  const now = new Date();
  const categories = {
    ODONTOLOGIA: {
      _id: toUuid(randomUUID()),
      organization_id: orgUuid,
      slug: 'odontologia',
      name: 'Odontología',
      active: true,
      ingest_source: MARKER,
      created_at: now,
      updated_at: now,
    },
    PSICOLOGIA: {
      _id: toUuid(randomUUID()),
      organization_id: orgUuid,
      slug: 'psicologia',
      name: 'Psicología',
      active: true,
      ingest_source: MARKER,
      created_at: now,
      updated_at: now,
    },
  };

  await catCol.insertMany([categories.ODONTOLOGIA, categories.PSICOLOGIA]);

  const { sites } = await loadSiteByDept(db, orgId);
  const siteCol = db.collection('sites');
  const siteDocs =
    sites.length > 0
      ? sites
      : await siteCol.find({ organization_id: orgUuid, status: 'ACTIVE' }).toArray();

  if (!siteDocs.length) {
    throw new Error('No hay sedes activas para crear service_offerings');
  }

  const catalogDocs = [];
  const offeringDocs = [];

  for (const svc of COP_SERVICE_CATALOG) {
    const catalogId = toUuid(randomUUID());
    const categoryId = categories[svc.category]._id;
    catalogDocs.push({
      _id: catalogId,
      organization_id: orgUuid,
      category_id: categoryId,
      code: svc.code,
      name: svc.name,
      description: svc.description,
      default_duration_minutes: svc.durationMinutes,
      specialty_match_tokens: svc.category === 'PSICOLOGIA' ? 'psicologia,psicologo' : 'odontologia,odontologo',
      active: true,
      ingest_source: MARKER,
      created_at: now,
      updated_at: now,
    });

    for (const site of siteDocs) {
      const siteId = site._id instanceof UUID ? site._id : toUuid(String(site._id));
      offeringDocs.push({
        _id: toUuid(randomUUID()),
        catalog_service_id: catalogId,
        public_title: svc.name,
        public_description: svc.description,
        base_price: svc.basePrice,
        promo_price: svc.promoPrice ?? null,
        currency: 'COP',
        visible_public: true,
        active: true,
        organization_id: orgUuid,
        site_id: siteId,
        features: svc.features,
        duration_minutes: svc.durationMinutes,
        ingest_source: MARKER,
        created_at: now,
        updated_at: now,
      });
    }
  }

  await catalogCol.insertMany(catalogDocs);
  for (let i = 0; i < offeringDocs.length; i += BATCH) {
    const chunk = offeringDocs.slice(i, i + BATCH);
    await offeringCol.insertMany(chunk, { ordered: false });
    console.log(`[35k] Offerings lote ${Math.floor(i / BATCH) + 1}: +${chunk.length}`);
  }

  return {
    categories: 2,
    catalogServices: catalogDocs.length,
    offerings: offeringDocs.length,
    sites: siteDocs.length,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const env = loadDotEnv();
  const uri = resolveMongoUri(env);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 60_000 });

  console.log(`[35k] Conectando a Atlas (org=${ORG_ID})...`);
  await client.connect();
  const db = client.db();

  try {
    let patientResult = { skipped: true };
    let catalogResult = { skipped: true };

    if (!args.soloCatalogo) {
      patientResult = await seedPatients(db, ORG_ID, args.forzar);
      console.log('[35k] Pacientes:', JSON.stringify(patientResult));
    }

    if (!args.soloPacientes) {
      catalogResult = await seedServiceCatalog(db, ORG_ID, args.forzar);
      console.log('[35k] Catálogo:', JSON.stringify(catalogResult));
    }

    console.log('[35k] Completado.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
