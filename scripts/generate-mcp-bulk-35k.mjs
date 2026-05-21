#!/usr/bin/env node
/**
 * Genera lotes JSON (500 docs) para insert-many vía MCP MongoDB:
 *   - patients: 35.000 (17.5k ODONTOLOGIA + 17.5k PSICOLOGIA)
 *
 * Catálogo (18 servicios × sedes) es más liviano: usar seed-bulk-35k-catalog endpoint o script Node.
 *
 *   node scripts/generate-mcp-bulk-35k.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { COLOMBIA_SITES_CATALOG } from './colombia-sites-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'deploy/mcp-payloads/bulk-35k');
const BATCH = 500;
const PER_AREA = 17_500;
const MARKER = 'mcp-bulk-35k';
const ORG_ID = process.env.APP_BOOTSTRAP_ADMIN_ORG_ID || 'be7f4015-67ad-472b-9cf7-aadcd8b0d604';

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
  const aliases = { bogota: 'Bogotá D.C.', valle: 'Valle del Cauca' };
  const canonical = aliases[key] || dept?.trim();
  const list = siteByDept.get(normDept(canonical));
  if (list?.length) return list[Math.floor(Math.random() * list.length)];
  const all = [...siteByDept.values()].flat();
  return all[Math.floor(Math.random() * all.length)];
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

function birthDateFromAge(edad) {
  const y = new Date().getFullYear() - edad;
  return new Date(`${y}-06-15T12:00:00.000Z`).toISOString();
}

function buildPatient(area, index, siteByDept) {
  const prefix = area === 'ODONTOLOGIA' ? 'ODO' : 'PSI';
  const code = `P-${prefix}-${String(200000 + index)}`;
  const departments = [...new Set(COLOMBIA_SITES_CATALOG.map((s) => s.department))];
  const site = resolveSite(departments[index % departments.length], siteByDept);
  const now = new Date().toISOString();
  const motivos =
    area === 'ODONTOLOGIA'
      ? ['Consulta', 'Cirugía', 'Chequeo', 'Emergencia', 'Ortodoncia']
      : ['Consulta', 'Terapia', 'Evaluación', 'Crisis', 'Seguimiento'];

  return {
    _id: randomUUID(),
    organization_id: ORG_ID,
    site_id: site?._id ?? null,
    external_code: code,
    full_name: `Paciente ${code}`,
    birth_date: birthDateFromAge(1 + (index % 85)),
    gender: index % 2 === 0 ? 'F' : 'M',
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

function main() {
  mkdirSync(outDir, { recursive: true });
  const siteByDept = buildSiteByDept();
  const docs = [];
  for (let i = 1; i <= PER_AREA; i++) docs.push(buildPatient('ODONTOLOGIA', i, siteByDept));
  for (let i = 1; i <= PER_AREA; i++) docs.push(buildPatient('PSICOLOGIA', i, siteByDept));

  const files = [];
  for (let i = 0; i < docs.length; i += BATCH) {
    const chunk = docs.slice(i, i + BATCH);
    const n = String(Math.floor(i / BATCH) + 1).padStart(3, '0');
    const path = resolve(outDir, `patients-batch-${n}.json`);
    writeFileSync(path, JSON.stringify(chunk));
    files.push({ path, count: chunk.length });
  }

  const manifest = {
    database: 'cop',
    organization_id: ORG_ID,
    marker: MARKER,
    total: docs.length,
    odonto: PER_AREA,
    psico: PER_AREA,
    batches: files.length,
    files,
    mcpHint: 'Call insert-many per file: database=cop, collection=patients',
  };
  writeFileSync(resolve(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`[mcp-35k] ${docs.length} pacientes en ${files.length} lotes → ${outDir}`);
}

main();
