import { Body, Controller, Get, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { TenancyInterceptor } from './tenancy.interceptor';
import { TenancyService } from './tenancy.service';
import { CreateSiteDto } from './dto/create-site.dto';

@ApiTags('sites')
@ApiBearerAuth()
@Controller('api/sites')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class SitesAdminController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get()
  @Roles('ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'SUPER_ADMIN')
  list(@Query('department') department?: string) {
    return this.tenancy.listActiveSites(department).then((sites) =>
      sites.map((s: any) => ({
        id: String(s._id),
        name: s.name,
        department: s.department ?? null,
        municipality: s.municipality ?? null,
        address: s.address ?? null,
        organization_id: String(s.organization_id),
      })),
    );
  }

  @Get('departments')
  @Roles('ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'SUPER_ADMIN', 'MEDICO', 'PROFESSIONAL')
  departments() {
    return this.tenancy.listDepartments().then((departments) => ({ departments }));
  }

  @Post('sync-catalog')
  @Roles('ADMIN', 'SUPER_ADMIN')
  syncCatalog() {
    return this.tenancy.syncColombiaCatalog();
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@Req() req: Request, @Body() dto: CreateSiteDto) {
    const tenant = (req as any).tenant;
    return this.tenancy.createSite({
      organization_id: String(tenant?.organizationId ?? dto.organizationId),
      name: dto.name,
      timezone: dto.timezone ?? 'America/Bogota',
      department: dto.department,
      municipality: dto.municipality,
      address: dto.address,
    });
  }
}
