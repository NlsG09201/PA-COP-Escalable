#!/usr/bin/env node
/**
 * Genera payloads JSON para MCP insert-many (catálogo público COP).
 *   node scripts/generate-catalog-mcp-payloads.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { COP_SERVICE_CATALOG } from './cop-service-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'deploy/mcp-payloads');
const ORG_ID = 'be7f4015-67ad-472b-9cf7-aadcd8b0d604';
const MARKER = 'mcp-bulk-35k';

/** @param {string} siteId */
export function buildCatalogPayloads(siteIds) {
  const now = new Date().toISOString();
  const catOdo = randomUUID();
  const catPsico = randomUUID();

  const categories = [
    {
      _id: catOdo,
      organization_id: ORG_ID,
      slug: 'odontologia',
      name: 'Odontología',
      active: true,
      ingest_source: MARKER,
      created_at: now,
      updated_at: now,
    },
    {
      _id: catPsico,
      organization_id: ORG_ID,
      slug: 'psicologia',
      name: 'Psicología',
      active: true,
      ingest_source: MARKER,
      created_at: now,
      updated_at: now,
    },
  ];

  const catalogServices = [];
  const offerings = [];

  for (const svc of COP_SERVICE_CATALOG) {
    const catalogId = randomUUID();
    const categoryId = svc.category === 'PSICOLOGIA' ? catPsico : catOdo;
    catalogServices.push({
      _id: catalogId,
      organization_id: ORG_ID,
      category_id: categoryId,
      code: svc.code,
      name: svc.name,
      description: svc.description,
      default_duration_minutes: svc.durationMinutes,
      specialty_match_tokens: svc.category === 'PSICOLOGIA' ? 'psicologia' : 'odontologia',
      active: true,
      ingest_source: MARKER,
      created_at: now,
      updated_at: now,
    });

    for (const siteId of siteIds) {
      offerings.push({
        _id: randomUUID(),
        catalog_service_id: catalogId,
        public_title: svc.name,
        public_description: svc.description,
        base_price: svc.basePrice,
        promo_price: svc.promoPrice ?? null,
        currency: 'COP',
        visible_public: true,
        active: true,
        organization_id: ORG_ID,
        site_id: siteId,
        features: svc.features,
        duration_minutes: svc.durationMinutes,
        ingest_source: MARKER,
        created_at: now,
        updated_at: now,
      });
    }
  }

  return { categories, catalogServices, offerings, stats: { sites: siteIds.length, services: COP_SERVICE_CATALOG.length } };
}

async function fetchSiteIds() {
  const api = process.env.PUBLIC_API_ORIGIN || 'https://pa-cop-escalable.onrender.com';
  const res = await fetch(`${api}/public/sites`);
  if (!res.ok) throw new Error(`GET /public/sites → ${res.status}`);
  const sites = await res.json();
  return sites.map((s) => String(s.id)).filter(Boolean);
}

async function main() {
  const siteIds = await fetchSiteIds();
  if (!siteIds.length) throw new Error('No hay sedes en /public/sites');

  const payloads = buildCatalogPayloads(siteIds);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'service_categories.json'), JSON.stringify(payloads.categories));
  writeFileSync(resolve(outDir, 'catalog_services.json'), JSON.stringify(payloads.catalogServices));
  writeFileSync(resolve(outDir, 'service_offerings.json'), JSON.stringify(payloads.offerings));
  writeFileSync(
    resolve(outDir, '_catalog_manifest.json'),
    JSON.stringify({ marker: MARKER, orgId: ORG_ID, ...payloads.stats, offerings: payloads.offerings.length }, null, 2),
  );
  console.log(
    `[catalog-mcp] ${payloads.categories.length} categorías, ${payloads.catalogServices.length} servicios, ${payloads.offerings.length} offerings (${siteIds.length} sedes)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
