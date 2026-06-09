import { createHash } from 'crypto';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { COLOMBIA_SITES_CATALOG } from './colombia-sites.catalog';
import { TenancyService } from './tenancy.service';

function isMongoUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /buffering timed out|ServerSelection|whitelist|ECONNREFUSED|ENOTFOUND|querySrv|not connected/i.test(msg);
}

function fallbackSiteId(seed: string): string {
  const hex = createHash('sha1').update(`cop-site:${seed}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, '0')}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

function catalogDepartments(): string[] {
  return [...new Set(COLOMBIA_SITES_CATALOG.map((s) => s.department).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );
}

function catalogSites(department?: string) {
  const departmentFilter = department?.trim().toLocaleLowerCase('es');
  return COLOMBIA_SITES_CATALOG.filter((s) =>
    departmentFilter ? s.department.toLocaleLowerCase('es') === departmentFilter : true,
  ).map((s) => ({
    id: fallbackSiteId(`${s.department}:${s.municipality}:${s.siteName}`),
    name: s.siteName,
    department: s.department,
    municipality: s.municipality,
    address: `${s.municipality}, ${s.department}, Colombia`,
    fallback: true,
  }));
}

@ApiTags('public')
@Controller('public')
export class PublicTenancyController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get('departments')
  async departments() {
    try {
      const departments = await this.tenancy.listDepartments();
      return { departments };
    } catch (err) {
      if (isMongoUnavailable(err)) {
        return { departments: catalogDepartments(), fallback: true };
      }
      throw err;
    }
  }

  @Get('sites')
  async sites(@Query('department') department?: string) {
    try {
      const sites = await this.tenancy.listActiveSites(department);
      return (sites ?? []).map((s: any) => ({
        id: String(s._id),
        name: String(s.name ?? 'Sede'),
        department: s.department ? String(s.department) : null,
        municipality: s.municipality ? String(s.municipality) : null,
        address: s.address ? String(s.address) : null,
      }));
    } catch (err) {
      if (isMongoUnavailable(err)) {
        return catalogSites(department);
      }
      throw err;
    }
  }
}
