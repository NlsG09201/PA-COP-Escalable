import { UUID } from 'bson';
import { TenantContext } from './tenancy.interceptor';

const ORG_WIDE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN']);

/** Acepta organization_id / site_id guardados como string UUID o BSON UUID. */
export function idVariants(id: string): unknown[] {
  const s = String(id).trim();
  const out: unknown[] = [s];
  try {
    out.push(new UUID(s));
  } catch {
    /* no es UUID válido */
  }
  return out;
}

export function isOrgWideTenant(tenant: TenantContext): boolean {
  return (tenant.roles ?? []).some((r) => ORG_WIDE_ROLES.has(String(r)));
}

/**
 * Filtro tenant para colecciones Atlas (patients, appointments, etc.).
 * Admins ven toda la organización; roles de sede filtran por site_id.
 */
export function buildTenantDocumentMatch(
  tenant: TenantContext,
  opts?: { patientsCollection?: boolean },
): Record<string, unknown> {
  const match: Record<string, unknown> = {
    organization_id: { $in: idVariants(tenant.organizationId) },
  };

  if (!tenant.siteId || isOrgWideTenant(tenant)) {
    return match;
  }

  const siteVariants = { $in: idVariants(tenant.siteId) };
  if (opts?.patientsCollection) {
    // Pacientes bulk pueden tener site_id aleatorio o null: sede solo filtra coincidencias explícitas.
    match.$or = [{ site_id: siteVariants }, { site_id: null }, { site_id: { $exists: false } }];
  } else {
    match.site_id = siteVariants;
  }

  return match;
}
