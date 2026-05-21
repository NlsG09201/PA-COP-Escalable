#!/usr/bin/env node
/**
 * Genera JSON para insertar en Atlas con el MCP MongoDB (insert-many).
 *   node scripts/generate-mcp-atlas-payloads.mjs
 * Salida: deploy/mcp-payloads/<coleccion>.json
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { COLOMBIA_SITES_CATALOG } from './colombia-sites-catalog.mjs';

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'deploy/mcp-payloads');
const require = createRequire(import.meta.url);
const bcrypt = require(resolve(root, 'nest-migration/node_modules/bcrypt'));

const ORG_ID = process.env.APP_BOOTSTRAP_ADMIN_ORG_ID || 'be7f4015-67ad-472b-9cf7-aadcd8b0d604';
const ADMIN_USER = process.env.APP_BOOTSTRAP_ADMIN_USERNAME || 'nelsonherazoi';
const ADMIN_PASS = process.env.APP_BOOTSTRAP_ADMIN_PASSWORD || 'Nelson09092001';
const ADMIN_EMAIL = process.env.APP_BOOTSTRAP_ADMIN_EMAIL || 'nelsondavid1954@gmail.com';
const DB = process.env.MONGODB_DB || 'cop';

mkdirSync(outDir, { recursive: true });

const now = new Date().toISOString();
const marker = 'mcp-atlas-deploy';

async function main() {
  const password_hash = await bcrypt.hash(ADMIN_PASS, 10);
  const siteIds = COLOMBIA_SITES_CATALOG.map(() => randomUUID());

  const payloads = {
    organizations: [
      {
        _id: ORG_ID,
        name: 'COP Nacional',
        status: 'ACTIVE',
        created_at: now,
        updated_at: now,
      },
    ],
    sites: COLOMBIA_SITES_CATALOG.map((row, i) => ({
      _id: siteIds[i],
      organization_id: ORG_ID,
      name: row.siteName,
      timezone: 'America/Bogota',
      department: row.department,
      municipality: row.municipality,
      address: `${row.municipality}, ${row.department}, Colombia`,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    })),
    users: [
      {
        _id: randomUUID(),
        username: ADMIN_USER.toLowerCase(),
        organization_id: ORG_ID,
        password_hash,
        roles: ['SUPER_ADMIN', 'ADMIN'],
        mfa_enabled: false,
        email: ADMIN_EMAIL,
        createdAt: now,
        updatedAt: now,
      },
    ],
    professionals: [
      {
        _id: randomUUID(),
        organization_id: ORG_ID,
        site_id: siteIds[0],
        full_name: 'Dra. Ana Odontóloga',
        specialty: 'ODONTOLOGIA',
        status: 'ACTIVE',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
      {
        _id: randomUUID(),
        organization_id: ORG_ID,
        site_id: siteIds[1],
        full_name: 'Dr. Luis Psicólogo',
        specialty: 'PSICOLOGIA',
        status: 'ACTIVE',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    ],
    public_reviews: [
      {
        authorName: 'Paciente COP',
        rating: 5,
        comment: 'Excelente atención.',
        status: 'APPROVED',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    ],
    refresh_tokens: [],
    patients: [],
    appointments: [],
    clinical_records: [],
    odontograms: [
      {
        _id: randomUUID(),
        organization_id: ORG_ID,
        site_id: siteIds[0],
        patient_id: ORG_ID,
        status: 'DRAFT',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    ],
    psychology_sessions: [
      {
        _id: randomUUID(),
        organization_id: ORG_ID,
        site_id: siteIds[0],
        patient_id: ORG_ID,
        session_date: now,
        status: 'COMPLETED',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    ],
    psychological_evaluations: [
      {
        _id: randomUUID(),
        organization_id: ORG_ID,
        patient_id: ORG_ID,
        instrument: 'J48',
        score: 0.42,
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    ],
    psychological_snapshots: [
      {
        _id: randomUUID(),
        organization_id: ORG_ID,
        patient_id: ORG_ID,
        features: { mood: 'stable' },
        ingest_source: marker,
        created_at: now,
      },
    ],
    j48_predictions: [
      {
        _id: randomUUID(),
        organization_id: ORG_ID,
        patient_id: ORG_ID,
        risk_level: 'LOW',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    ],
    medical_ai_alerts: [
      {
        _id: randomUUID(),
        organization_id: ORG_ID,
        patient_id: ORG_ID,
        severity: 'INFO',
        message: 'Alerta ejemplo MCP',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    ],
    medical_ai_predictions: [
      {
        _id: randomUUID(),
        organization_id: ORG_ID,
        patient_id: ORG_ID,
        model: 'ensemble',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    ],
    medical_ai_insights: [
      {
        _id: randomUUID(),
        organization_id: ORG_ID,
        patient_id: ORG_ID,
        summary: 'Insight ejemplo',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    ],
    medical_ai_assistant_threads: [
      {
        organization_id: ORG_ID,
        patient_id: ORG_ID,
        messages: [],
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    ],
    ortho_3d_jobs: [
      {
        _id: randomUUID(),
        organization_id: ORG_ID,
        patient_id: ORG_ID,
        status: 'QUEUED',
        ingest_source: marker,
        created_at: now,
        updated_at: now,
      },
    ],
  };

  writeFileSync(
    resolve(outDir, '_manifest.json'),
    JSON.stringify({ database: DB, collections: ATLAS_COLLECTIONS, generatedAt: now }, null, 2),
  );

  for (const name of ATLAS_COLLECTIONS) {
    const docs = payloads[name] ?? [];
    writeFileSync(resolve(outDir, `${name}.json`), JSON.stringify(docs, null, 2));
    console.log(`[mcp-payloads] ${name}.json (${docs.length} docs)`);
  }

  console.log('');
  console.log('Pacientes (15000): usa node scripts/seed-atlas-completo.mjs --pacientes 15000');
  console.log(`Payloads en: ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
