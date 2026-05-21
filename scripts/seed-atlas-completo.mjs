#!/usr/bin/env node
/**
 * Carga en MongoDB Atlas: organización, sedes Colombia, admin y N pacientes.
 *
 *   node scripts/seed-atlas-completo.mjs
 *   node scripts/seed-atlas-completo.mjs --pacientes 15000 --forzar-pacientes
 *   node scripts/seed-atlas-completo.mjs --solo-colecciones
 *   node scripts/seed-atlas-completo.mjs --sin-muestras
 *
 * Requiere .env en la raíz: MONGODB_URL o MONGODB_PASSWORD + APP_BOOTSTRAP_* .
 */
/** Colecciones del backend Nest (docs/MONGODB_ATLAS_COLECCIONES.md) */
const ATLAS_COLLECTIONS = [
  'organizations',
  'sites',
  'users',
  'refresh_tokens',
  'professionals',
  'patients',
  'appointments',
  'clinical_records',
  'odontograms',
  'psychology_sessions',
  'psychological_evaluations',
  'psychological_snapshots',
  'j48_predictions',
  'medical_ai_alerts',
  'medical_ai_predictions',
  'medical_ai_insights',
  'medical_ai_assistant_threads',
  'ortho_3d_jobs',
  'public_reviews',
];
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
  const out = {
    pacientes: PATIENT_TARGET,
    forzarPacientes: false,
    soloColecciones: false,
    sinMuestras: false,
    csv: '',
    uri: '',
    adminUser: '',
    adminPass: '',
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--forzar-pacientes') out.forzarPacientes = true;
    else if (argv[i] === '--solo-colecciones') out.soloColecciones = true;
    else if (argv[i] === '--sin-muestras') out.sinMuestras = true;
    else if (argv[i] === '--pacientes' && argv[i + 1]) {
      out.pacientes = Math.max(0, parseInt(argv[++i], 10));
    } else if (argv[i] === '--csv' && argv[i + 1]) {
      out.csv = argv[++i];
    } else if (argv[i] === '--uri' && argv[i + 1]) {
      out.uri = argv[++i];
    } else if (argv[i] === '--admin-user' && argv[i + 1]) {
      out.adminUser = argv[++i];
    } else if (argv[i] === '--admin-password' && argv[i + 1]) {
      out.adminPass = argv[++i];
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

async function ensureCollections(db) {
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  let created = 0;
  for (const name of ATLAS_COLLECTIONS) {
    if (existing.has(name)) continue;
    await db.createCollection(name);
    created += 1;
    console.log(`[seed] Colección creada: ${name}`);
  }
  console.log(`[seed] Colecciones: ${ATLAS_COLLECTIONS.length} definidas, +${created} nuevas`);
  return created;
}

function orgIdString(env, orgId) {
  const fromEnv = String(env.APP_BOOTSTRAP_ADMIN_ORG_ID ?? '').trim();
  if (fromEnv) return fromEnv;
  try {
    return orgId.toString();
  } catch {
    return String(orgId);
  }
}

async function seedAdmin(db, orgId, env, cli = {}) {
  const username = (cli.adminUser || env.APP_BOOTSTRAP_ADMIN_USERNAME || '').trim().toLowerCase();
  const password = cli.adminPass || env.APP_BOOTSTRAP_ADMIN_PASSWORD || '';
  const email = (env.APP_BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!username || !password) {
    console.warn('[seed] Sin APP_BOOTSTRAP_ADMIN_USERNAME/PASSWORD — omitiendo admin');
    return null;
  }

  const password_hash = await bcrypt.hash(password, 10);
  const orgStr = orgIdString(env, orgId);
  const col = db.collection('users');
  const usernameRegex = new RegExp(
    `^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
    'i',
  );
  await col.deleteMany({ username: usernameRegex });
  const userId = randomUUID();
  await col.insertOne({
    _id: userId,
    username,
    organization_id: orgStr,
    password_hash,
    roles: ['SUPER_ADMIN', 'ADMIN'],
    mfa_enabled: false,
    ...(email ? { email } : {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log(`[seed] Admin: ${username} (_id string, password_hash actualizado)`);
  return { userId, username, orgStr };
}

async function seedSampleData(db, ctx) {
  const { orgId, orgStr, siteId, adminUserId, adminUsername } = ctx;
  const now = new Date();
  const marker = 'seed-atlas-completo';

  const profCol = db.collection('professionals');
  const profCount = await profCol.countDocuments({ organization_id: orgStr, ingest_source: marker });
  if (profCount === 0) {
    const pros = [
      { full_name: 'Dra. Ana Odontóloga', specialty: 'ODONTOLOGIA' },
      { full_name: 'Dr. Luis Psicólogo', specialty: 'PSICOLOGIA' },
      { full_name: 'Dra. María Clínica', specialty: 'MEDICINA_GENERAL' },
    ];
    await profCol.insertMany(
      pros.map((p) => ({
        _id: randomUUID(),
        organization_id: orgStr,
        site_id: siteId ? String(siteId) : undefined,
        default_site_id: siteId ? String(siteId) : undefined,
        full_name: p.full_name,
        specialty: p.specialty,
        status: 'ACTIVE',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      })),
    );
    console.log(`[seed] Profesionales: +${pros.length}`);
  }

  const professionals = await profCol.find({ organization_id: orgStr }).limit(3).toArray();
  const patients = await db
    .collection('patients')
    .find({ organization_id: orgId })
    .limit(200)
    .toArray();

  if (professionals.length && patients.length) {
    const apptCol = db.collection('appointments');
    const apptExisting = await apptCol.countDocuments({ organization_id: orgStr, ingest_source: marker });
    if (apptExisting === 0) {
      const appts = [];
      for (let i = 0; i < Math.min(80, patients.length); i++) {
        const p = patients[i];
        const pro = professionals[i % professionals.length];
        const start = new Date(now.getTime() + (i + 1) * 86_400_000);
        const end = new Date(start.getTime() + 45 * 60_000);
        appts.push({
          _id: randomUUID(),
          organization_id: orgStr,
          site_id: p.site_id ? String(p.site_id) : orgStr,
          professional_id: String(pro._id),
          patient_id: String(p._id),
          start_at: start,
          end_at: end,
          status: i % 4 === 0 ? 'COMPLETED' : 'CONFIRMED',
          reason: 'Control COP',
          ingest_source: marker,
          version: 0,
          created_at: now,
          updated_at: now,
        });
      }
      await apptCol.insertMany(appts, { ordered: false });
      console.log(`[seed] Citas: +${appts.length}`);
    }

    const clinCol = db.collection('clinical_records');
    const clinExisting = await clinCol.countDocuments({ organizationId: orgStr, ingest_source: marker });
    if (clinExisting === 0) {
      const records = patients.slice(0, 40).map((p, i) => ({
        _id: randomUUID(),
        organizationId: orgStr,
        siteId: p.site_id ? String(p.site_id) : undefined,
        patientId: String(p._id),
        entries: [
          {
            at: now,
            author_user_id: adminUserId,
            author_username: adminUsername,
            type: 'NOTA',
            note: `Historia inicial paciente ${p.external_code ?? i}`,
          },
        ],
        ingest_source: marker,
        createdAt: now,
        updatedAt: now,
      }));
      await clinCol.insertMany(records, { ordered: false });
      console.log(`[seed] Historias clínicas: +${records.length}`);
    }
  }

  const reviewCol = db.collection('public_reviews');
  if ((await reviewCol.countDocuments({ ingest_source: marker })) === 0) {
    await reviewCol.insertMany([
      {
        authorName: 'Paciente COP',
        rating: 5,
        comment: 'Excelente atención en la sede.',
        status: 'APPROVED',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
      {
        authorName: 'Usuario verificado',
        rating: 4,
        comment: 'Muy buen servicio clínico.',
        status: 'APPROVED',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    ]);
    console.log('[seed] Reseñas públicas: +2');
  }

  const sampleDocs = [
    {
      col: 'odontograms',
      doc: {
        _id: randomUUID(),
        organization_id: orgStr,
        site_id: siteId ? String(siteId) : orgStr,
        patient_id: patients[0] ? String(patients[0]._id) : orgStr,
        status: 'DRAFT',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    },
    {
      col: 'psychology_sessions',
      doc: {
        _id: randomUUID(),
        organization_id: orgStr,
        site_id: siteId ? String(siteId) : orgStr,
        patient_id: patients[0] ? String(patients[0]._id) : orgStr,
        session_date: now,
        status: 'COMPLETED',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    },
    {
      col: 'psychological_evaluations',
      doc: {
        _id: randomUUID(),
        organization_id: orgStr,
        patient_id: patients[0] ? String(patients[0]._id) : orgStr,
        instrument: 'J48',
        score: 0.42,
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    },
    {
      col: 'psychological_snapshots',
      doc: {
        _id: randomUUID(),
        organization_id: orgStr,
        patient_id: patients[0] ? String(patients[0]._id) : orgStr,
        features: { mood: 'stable' },
        ingest_source: marker,
        created_at: now,
      },
    },
    {
      col: 'j48_predictions',
      doc: {
        _id: randomUUID(),
        organization_id: orgStr,
        patient_id: patients[0] ? String(patients[0]._id) : orgStr,
        risk_level: 'LOW',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    },
    {
      col: 'medical_ai_alerts',
      doc: {
        _id: randomUUID(),
        organization_id: orgStr,
        patient_id: patients[0] ? String(patients[0]._id) : orgStr,
        severity: 'INFO',
        message: 'Alerta de ejemplo seed',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    },
    {
      col: 'medical_ai_predictions',
      doc: {
        _id: randomUUID(),
        organization_id: orgStr,
        patient_id: patients[0] ? String(patients[0]._id) : orgStr,
        model: 'ensemble',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    },
    {
      col: 'medical_ai_insights',
      doc: {
        _id: randomUUID(),
        organization_id: orgStr,
        patient_id: patients[0] ? String(patients[0]._id) : orgStr,
        summary: 'Insight de ejemplo',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    },
    {
      col: 'medical_ai_assistant_threads',
      doc: {
        organization_id: orgStr,
        patient_id: patients[0] ? String(patients[0]._id) : orgStr,
        messages: [],
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    },
    {
      col: 'ortho_3d_jobs',
      doc: {
        _id: randomUUID(),
        organization_id: orgStr,
        patient_id: patients[0] ? String(patients[0]._id) : orgStr,
        status: 'QUEUED',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    },
  ];

  for (const { col, doc } of sampleDocs) {
    const c = db.collection(col);
    if ((await c.countDocuments({ ingest_source: marker })) > 0) continue;
    await c.insertOne(doc);
    console.log(`[seed] ${col}: +1 documento muestra`);
  }
}

async function seedPatients(db, orgId, siteByDept, opts) {
  if (opts.pacientes <= 0) {
    console.log('[seed] Pacientes: omitido (--pacientes 0)');
    return { inserted: 0, total: await db.collection('patients').countDocuments() };
  }

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
  const uri = opts.uri?.trim() || process.env.MONGODB_URL?.trim() || resolveMongoUri(env);

  console.log('[seed] Conectando a Atlas...');
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 60_000,
    connectTimeoutMS: 60_000,
  });
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
  } catch (err) {
    const msg = err?.message ?? String(err);
    console.error('\n[seed] No se pudo conectar a MongoDB Atlas.');
    if (/querySrv|ENOTFOUND|ECONNREFUSED|timed out/i.test(msg)) {
      console.error(`
  1. Atlas -> Network Access -> 0.0.0.0/0 Active
  2. Atlas -> Database -> Connect -> copia la URI y actualiza .env MONGODB_URL
  3. Comprueba internet/DNS (nslookup cluster0.6oyhyja.mongodb.net)
  4. Vuelve a ejecutar: .\\deploy\\cargar-atlas-completo.ps1
`);
    }
    throw err;
  }

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

  await ensureCollections(db);

  if (opts.soloColecciones) {
    console.log('[seed] Modo --solo-colecciones: colecciones listas, sin datos.');
    await client.close();
    return;
  }

  const orgId = await seedOrganization(db, env);
  const orgStr = orgIdString(env, orgId);
  console.log(`[seed] Organización: ${orgStr}`);

  const { created: sitesNew, total: sitesTotal, siteByDept } = await seedSites(db, orgId);
  console.log(`[seed] Sedes: +${sitesNew} nuevas, ${sitesTotal} activas en catálogo`);

  const firstSite = [...siteByDept.values()].flat()[0];
  const siteId = firstSite?._id;

  const admin = await seedAdmin(db, orgId, env, {
    adminUser: opts.adminUser,
    adminPass: opts.adminPass,
  });

  const { inserted, total } = await seedPatients(db, orgId, siteByDept, opts);
  console.log(`[seed] Pacientes: +${inserted}, total en org: ${total}`);

  if (!opts.sinMuestras && admin) {
    await seedSampleData(db, {
      orgId,
      orgStr,
      siteId,
      adminUserId: admin.userId,
      adminUsername: admin.username,
    });
  } else if (opts.sinMuestras) {
    console.log('[seed] Modo --sin-muestras: omitiendo citas, clínica, IA, etc.');
  }

  const summary = {};
  for (const name of ATLAS_COLLECTIONS) {
    summary[name] = await db.collection(name).countDocuments();
  }
  console.log('[seed] Resumen Atlas (documentos por colección):', summary);

  await client.close();
  console.log('[seed] Listo.');
}

main().catch((err) => {
  console.error('[seed] Error:', err.message || err);
  process.exit(1);
});
