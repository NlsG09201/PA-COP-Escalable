import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenancyService } from './tenancy.service';

@ApiTags('public')
@Controller('public')
export class PublicTenancyController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get('departments')
  async departments() {
    const departments = await this.tenancy.listDepartments();
    return { departments };
  }

  @Get('sites')
  async sites(@Query('department') department?: string) {
    const sites = await this.tenancy.listActiveSites(department);
    return (sites ?? []).map((s: any) => ({
      id: String(s._id),
      name: String(s.name ?? 'Sede'),
      department: s.department ? String(s.department) : null,
      municipality: s.municipality ? String(s.municipality) : null,
      address: s.address ? String(s.address) : null,
    }));
  }
}

