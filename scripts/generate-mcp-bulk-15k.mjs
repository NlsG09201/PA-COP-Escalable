#!/usr/bin/env node
/**
 * Genera lotes JSON (500 docs) para insert-many vía MCP MongoDB:
 *   - patients (15.000)
 *   - j48_predictions (15.000 desde datasets/relapse_risk_j48.arff)
 *
 *   node scripts/generate-mcp-bulk-15k.mjs
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { COLOMBIA_SITES_CATALOG } from './colombia-sites-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'deploy/mcp-payloads/bulk');
const BATCH = 500;
const TARGET = 15_000;
const MARKER = 'mcp-bulk-15k';

const ORG_ID = process.env.APP_BOOTSTRAP_ADMIN_ORG_ID || 'be7f4015-67ad-472b-9cf7-aadcd8b0d604';

const DEPT_ALIASES = {
  bogotá: 'Bogotá D.C.',
  bogota: 'Bogotá D.C.',
  valle: 'Valle del Cauca',
  'valle del cauca': 'Valle del Cauca',
};

function normDept(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function buildSiteByDept() {
  const siteByDept = new Map();
  for (const row of COLOMBIA_SITES_CATALOG) {
    const key = normDept(row.department);
    if (!siteByDept.has(key)) siteByDept.set(key, []);
    siteByDept.get(key).push({ _id: randomUUID(), department: row.department });
  }
  return siteByDept;
}

function resolveSite(dept, siteByDept) {
  const key = normDept(dept);
  const canonical = DEPT_ALIASES[key] || dept?.trim();
  const sites = siteByDept.get(normDept(canonical));
  if (sites?.length) return sites[Math.floor(Math.random() * sites.length)];
  const all = [...siteByDept.values()].flat();
  return all[Math.floor(Math.random() * all.length)];
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

function birthDateFromAge(edad) {
  const age = Math.min(100, Math.max(0, parseInt(String(edad), 10) || 30));
  const y = new Date().getFullYear() - age;
  return new Date(`${y}-06-15T12:00:00.000Z`);
}

function genderFromRaw(g) {
  const s = String(g ?? '').trim().toUpperCase();
  if (s.startsWith('F')) return 'F';
  if (s.startsWith('M')) return 'M';
  return 'O';
}

function parseCsvRows(csvPath) {
  const raw = readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('...') || line.startsWith('#')) continue;
    if (i === 0 && line.toLowerCase().includes('id_paciente')) continue;
    const parts = line.split(',');
    if (parts.length < 6) continue;
    rows.push({
      id_paciente: parts[0],
      departamento: parts[2],
      edad: parts[4],
      genero: parts[5],
      motivo_ingreso: parts[6] ?? '',
      regimen: parts[7] ?? '',
    });
  }
  return rows;
}

function generatePatientRows(count) {
  const departments = [...new Set(COLOMBIA_SITES_CATALOG.map((s) => s.department))];
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

function buildPatientDoc(row, site) {
  const now = new Date().toISOString();
  const id = randomUUID();
  return {
    _id: id,
    organization_id: ORG_ID,
    site_id: site?._id ?? null,
    external_code: String(row.id_paciente),
    full_name: `Paciente ${row.id_paciente}`,
    birth_date: birthDateFromAge(row.edad).toISOString(),
    gender: genderFromRaw(row.genero),
    phone: `+573${String(Math.abs(hashCode(row.id_paciente)) % 1_000_000_000).padStart(9, '0')}`,
    email: `paciente.${String(row.id_paciente).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@cop-pacientes.local`,
    status: 'ACTIVE',
    ingest_source: MARKER,
    ingest_motivo: row.motivo_ingreso || null,
    ingest_regimen: row.regimen || null,
    created_at: now,
    updated_at: now,
    /** Para enlazar j48 en el mismo lote */
    __patientId: id,
    __siteId: site?._id ?? null,
  };
}

function parseArffRows(arffPath) {
  const raw = readFileSync(arffPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('@')) continue;
    const parts = t.split(',').map((p) => p.trim());
    if (parts.length < 9) continue;
    const [gender, age_group, sentiment, wellbeing, anxiety, depression, attendance, days_since_last, classLabel] =
      parts;
    rows.push({
      features: {
        gender,
        age_group,
        sentiment,
        wellbeing,
        anxiety: Number(anxiety),
        depression: Number(depression),
        attendance,
        days_since_last: Number(days_since_last),
      },
      classLabel,
    });
  }
  return rows;
}

function buildJ48Doc(patient, arffRow, index) {
  const now = new Date().toISOString();
  const probs = { LOW: 0.1, MEDIUM: 0.2, HIGH: 0.7 };
  const label = arffRow.classLabel;
  const p = { LOW: 0.05, MEDIUM: 0.15, HIGH: 0.05 };
  p[label] = 0.8;
  const sum = Object.values(p).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(p)) p[k] = Math.round((p[k] / sum) * 1000) / 1000;

  return {
    organizationId: ORG_ID,
    siteId: patient.__siteId,
    patientId: patient.__patientId,
    scoredAt: now,
    features: arffRow.features,
    classLabel: label,
    probabilities: p,
    ingest_source: MARKER,
    ingest_index: index,
    created_at: now,
    updated_at: now,
  };
}

function writeBatches(prefix, docs) {
  const files = [];
  for (let i = 0; i < docs.length; i += BATCH) {
    const chunk = docs.slice(i, i + BATCH);
    const n = String(Math.floor(i / BATCH) + 1).padStart(3, '0');
    const path = resolve(outDir, `${prefix}-batch-${n}.json`);
    writeFileSync(path, JSON.stringify(chunk, null, 0));
    files.push({ path, collection: prefix === 'patients' ? 'patients' : 'j48_predictions', count: chunk.length });
  }
  return files;
}

function main() {
  mkdirSync(outDir, { recursive: true });

  const csvPath = resolve(root, 'pacientes_colombia_15k.csv');
  let patientRows = existsSync(csvPath) ? parseCsvRows(csvPath) : [];
  if (patientRows.length < TARGET) {
    patientRows = generatePatientRows(TARGET);
    console.log(`[bulk] Pacientes sintéticos: ${patientRows.length}`);
  } else {
    patientRows = patientRows.slice(0, TARGET);
    console.log(`[bulk] CSV pacientes: ${patientRows.length}`);
  }

  const arffPath = resolve(root, 'datasets/relapse_risk_j48.arff');
  let arffRows = parseArffRows(arffPath);
  if (arffRows.length < TARGET) {
    throw new Error(`ARFF tiene ${arffRows.length} filas; se requieren ${TARGET}`);
  }
  arffRows = arffRows.slice(0, TARGET);
  console.log(`[bulk] ARFF j48: ${arffRows.length}`);

  const siteByDept = buildSiteByDept();
  const patients = patientRows.map((row) => {
    const site = resolveSite(row.departamento, siteByDept);
    return buildPatientDoc(row, site);
  });

  const j48Docs = patients.map((p, i) => buildJ48Doc(p, arffRows[i], i + 1));
  const patientsClean = patients.map(({ __patientId, __siteId, ...doc }) => doc);

  const patientFiles = writeBatches('patients', patientsClean);
  const j48Files = writeBatches('j48_predictions', j48Docs);

  const manifest = {
    database: process.env.MONGODB_DB || 'cop',
    organization_id: ORG_ID,
    marker: MARKER,
    patients: { total: patientsClean.length, batches: patientFiles.length },
    j48_predictions: { total: j48Docs.length, batches: j48Files.length },
    files: [...patientFiles, ...j48Files],
  };
  const manifestPath = resolve(outDir, '_manifest-bulk.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`[bulk] Manifest: ${manifestPath}`);
  console.log(`[bulk] ${patientFiles.length} lotes patients + ${j48Files.length} lotes j48_predictions`);
}

main();
