#!/usr/bin/env node
/**
 * Carga en MongoDB Atlas: organización, sedes Colombia, admin y N pacientes.
 *
 *   node scripts/seed-atlas-completo.mjs
 *   node scripts/seed-atlas-completo.mjs --pacientes 15000 --forzar-pacientes
 *
 * Requiere .env en la raíz: MONGODB_URL o MONGODB_PASSWORD + APP_BOOTSTRAP_* .
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { MongoClient, UUID } from 'mongodb';
import { COLOMBIA_SITES_CATALOG } from './colombia-sites-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const bcrypt = require(resolve(root, 'nest-migration/node_modules/bcrypt'));

const PATIENT_TARGET = 15_000;
const BATCH = 500;

const DEPT_ALIASES = {
  bogotá: 'Bogotá D.C.',
  bogota: 'Bogotá D.C.',
  valle: 'Valle del Cauca',
  'valle del cauca': 'Valle del Cauca',
  cundinamarca: 'Cundinamarca',
  atlantico: 'Atlántico',
  atlántico: 'Atlántico',
};

function parseArgs(argv) {
  const out = { pacientes: PATIENT_TARGET, forzarPacientes: false, csv: '' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--forzar-pacientes') out.forzarPacientes = true;
    else if (argv[i] === '--pacientes' && argv[i + 1]) {
      out.pacientes = Math.max(1, parseInt(argv[++i], 10));
    } else if (argv[i] === '--csv' && argv[i + 1]) {
      out.csv = argv[++i];
    }
  }
  return out;
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
    let val = line.slice(idx + 1).trim();
    val = val.replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
  return env;
}

function resolveMongoUri(env) {
  let url = env.MONGODB_ATLAS_URI || env.MONGODB_URL || '';
  if (url.includes('<db_password>') && env.MONGODB_PASSWORD) {
    const user = env.MONGODB_USER || 'nelsonherazoi';
    const host = env.MONGODB_HOST || 'cluster0.6oyhyja.mongodb.net';
    const db = env.MONGODB_DB || 'cop';
    url = `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(env.MONGODB_PASSWORD)}@${host}/${db}?retryWrites=true&w=majority&appName=Cluster0`;
  }
  if (!url.startsWith('mongodb')) {
    throw new Error('Falta MONGODB_URL o MONGODB_PASSWORD en .env');
  }
  return url;
}

function toUuid(value) {
  if (value instanceof UUID) return value;
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

function resolveDepartment(raw, siteByDept) {
  const key = normDept(raw);
  const canonical = DEPT_ALIASES[key] || raw?.trim();
  if (!canonical) return null;
  const sites = siteByDept.get(normDept(canonical));
  if (sites?.length) return sites[Math.floor(Math.random() * sites.length)];
  for (const [k, list] of siteByDept) {
    if (k.includes(key) || key.includes(k)) return list[0];
  }
  const all = [...siteByDept.values()].flat();
  return all[Math.floor(Math.random() * all.length)];
}

function birthDateFromAge(edad) {
  const age = Math.min(100, Math.max(0, parseInt(String(edad), 10) || 30));
  const y = new Date().getFullYear() - age;
  return new Date(`${y}-06-15`);
}

function genderFromRaw(g) {
  const s = String(g ?? '').trim().toUpperCase();
  if (s.startsWith('F')) return 'F';
  if (s.startsWith('M')) return 'M';
  return 'O';
}

function parseCsvRows(csvPath) {
  const raw = readFileSync(csvPath, 'utf8');
  const lines = raw.includes('\\n') ? raw.split('\\n') : raw.split(/\r?\n/);
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('...') || line.startsWith('#')) continue;
    if (i === 0 && line.toLowerCase().includes('id_paciente')) continue;
    const parts = line.split(',');
    if (parts.length < 6) continue;
    rows.push({
      id_paciente: parts[0],
      fecha_ingreso: parts[1],
      departamento: parts[2],
      edad: parts[4],
      genero: parts[5],
      motivo_ingreso: parts[6] ?? '',
      regimen: parts[7] ?? '',
    });
  }
  return rows;
}

function generatePatientRows(count, departments) {
  const motivos = ['Enfermedad', 'Accidente', 'Consulta', 'Cirugía', 'Chequeo', 'Emergencia'];
  const rows = [];
  for (let n = 1; n <= count; n++) {
    rows.push({
      id_paciente: `P-${String(100000 + n)}`,
      departamento: departments[n % departments.length],
      edad: 1 + (n % 85),
      genero: n % 2 === 0 ? 'F' : 'M',
      motivo_ingreso: motivos[n % motivos.length],
      regimen: n % 3 === 0 ? 'Subsidiado' : 'Contributivo',
    });
  }
  return rows;
}

function buildPatientDoc(row, orgId, siteByDept) {
  const site = resolveDepartment(row.departamento, siteByDept);
  const siteId = site?._id;
  const now = new Date();
  return {
    _id: toUuid(randomUUID()),
    organization_id: orgId,
    site_id: siteId,
    external_code: String(row.id_paciente),
    full_name: `Paciente ${row.id_paciente}`,
    birth_date: birthDateFromAge(row.edad),
    gender: genderFromRaw(row.genero),
    phone: `+573${String(Math.abs(hashCode(row.id_paciente)) % 1_000_000_000).padStart(9, '0')}`,
    email: `paciente.${String(row.id_paciente).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@cop-pacientes.local`,
    status: 'ACTIVE',
    ingest_source: 'seed-atlas-completo',
    ingest_motivo: row.motivo_ingreso || null,
    ingest_regimen: row.regimen || null,
    created_at: now,
    updated_at: now,
  };
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

async function seedOrganization(db, env) {
  const orgIdStr = env.APP_BOOTSTRAP_ADMIN_ORG_ID || randomUUID();
  const orgId = toUuid(orgIdStr);
  const col = db.collection('organizations');
  await col.updateOne(
    { _id: orgId },
    {
      $setOnInsert: {
        _id: orgId,
        name: 'COP Nacional',
        status: 'ACTIVE',
        created_at: new Date(),
      },
      $set: { updated_at: new Date(), status: 'ACTIVE' },
    },
    { upsert: true },
  );
  return orgId;
}

async function seedSites(db, orgId) {
  const col = db.collection('sites');
  let created = 0;
  const siteByDept = new Map();

  for (const row of COLOMBIA_SITES_CATALOG) {
    const existing = await col.findOne({
      organization_id: orgId,
      name: row.siteName,
      department: row.department,
    });
    let siteId;
    if (existing) {
      siteId = existing._id;
    } else {
      siteId = toUuid(randomUUID());
      await col.insertOne({
        _id: siteId,
        organization_id: orgId,
        name: row.siteName,
        timezone: 'America/Bogota',
        department: row.department,
        municipality: row.municipality,
        address: `${row.municipality}, ${row.department}, Colombia`,
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
      });
      created += 1;
    }
    const key = normDept(row.department);
    if (!siteByDept.has(key)) siteByDept.set(key, []);
    siteByDept.get(key).push({ _id: siteId, department: row.department });
  }

  const total = await col.countDocuments({ status: 'ACTIVE' });
  return { created, total, siteByDept };
}

async function seedAdmin(db, orgId, env) {
  const username = (env.APP_BOOTSTRAP_ADMIN_USERNAME || '').trim().toLowerCase();
  const password = env.APP_BOOTSTRAP_ADMIN_PASSWORD || '';
  const email = (env.APP_BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!username || !password) {
    console.warn('[seed] Sin APP_BOOTSTRAP_ADMIN_USERNAME/PASSWORD — omitiendo admin');
    return;
  }

  const password_hash = await bcrypt.hash(password, 10);
  const col = db.collection('users');
  await col.updateOne(
    { username },
    {
      $set: {
        username,
        organization_id: orgId,
        password_hash,
        roles: ['SUPER_ADMIN', 'ADMIN'],
        mfa_enabled: false,
        ...(email ? { email } : {}),
        updatedAt: new Date(),
      },
      $setOnInsert: {
        _id: toUuid(randomUUID()),
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  console.log(`[seed] Admin: ${username}`);
}

async function seedPatients(db, orgId, siteByDept, opts) {
  const col = db.collection('patients');
  const existing = await col.countDocuments({ organization_id: orgId });
  if (existing >= opts.pacientes && !opts.forzarPacientes) {
    console.log(`[seed] Pacientes: ya hay ${existing} (objetivo ${opts.pacientes}), omitiendo`);
    return { inserted: 0, total: existing };
  }

  if (opts.forzarPacientes && existing > 0) {
    const del = await col.deleteMany({ organization_id: orgId, ingest_source: 'seed-atlas-completo' });
    console.log(`[seed] Eliminados ${del.deletedCount} pacientes de seed anterior`);
  }

  let rows = [];
  const csvPath = opts.csv || resolve(root, 'pacientes_colombia_15k.csv');
  if (existsSync(csvPath)) {
    rows = parseCsvRows(csvPath);
    console.log(`[seed] CSV: ${rows.length} filas leídas de ${csvPath}`);
  }
  if (rows.length < opts.pacientes) {
    const depts = [...new Set(COLOMBIA_SITES_CATALOG.map((s) => s.department))];
    const generated = generatePatientRows(opts.pacientes, depts);
    rows = generated;
    console.log(`[seed] Generados ${rows.length} pacientes sintéticos`);
  } else {
    rows = rows.slice(0, opts.pacientes);
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((r) => buildPatientDoc(r, orgId, siteByDept));
    if (chunk.length) {
      await col.insertMany(chunk, { ordered: false });
      inserted += chunk.length;
      process.stdout.write(`\r[seed] Pacientes insertados: ${inserted}/${rows.length}`);
    }
  }
  console.log('');
  const total = await col.countDocuments({ organization_id: orgId });
  return { inserted, total };
}

async function main() {
  const opts = parseArgs(process.argv);
  const env = loadDotEnv();
  const uri = resolveMongoUri(env);

  console.log('[seed] Conectando a Atlas...');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 60_000 });
  await client.connect();

  const dbName =
    env.MONGODB_DB ||
    (() => {
      try {
        const normalized = uri.replace(/^mongodb\+srv:/, 'mongodb:').replace(/^mongodb:/, 'http:');
        const path = new URL(normalized).pathname.replace(/^\//, '').split('/')[0];
        return path || 'cop';
      } catch {
        return 'cop';
      }
    })();
  const db = client.db(dbName);
  console.log(`[seed] Base de datos: ${dbName}`);

  const orgId = await seedOrganization(db, env);
  console.log(`[seed] Organización: ${orgId}`);

  const { created: sitesNew, total: sitesTotal, siteByDept } = await seedSites(db, orgId);
  console.log(`[seed] Sedes: +${sitesNew} nuevas, ${sitesTotal} activas en catálogo`);

  await seedAdmin(db, orgId, env);

  const { inserted, total } = await seedPatients(db, orgId, siteByDept, opts);
  console.log(`[seed] Pacientes: +${inserted}, total en org: ${total}`);

  const summary = {
    organizations: await db.collection('organizations').countDocuments(),
    sites: await db.collection('sites').countDocuments({ status: 'ACTIVE' }),
    users: await db.collection('users').countDocuments(),
    patients: await db.collection('patients').countDocuments(),
  };
  console.log('[seed] Resumen Atlas:', summary);

  await client.close();
  console.log('[seed] Listo.');
}

main().catch((err) => {
  console.error('[seed] Error:', err.message || err);
  process.exit(1);
});
