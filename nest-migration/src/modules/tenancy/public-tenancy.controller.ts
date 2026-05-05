import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenancyService } from './tenancy.service';

@ApiTags('public')
@Controller('public')
export class PublicTenancyController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get('sites')
  async sites() {
    // For login UI: list all active sites (across organizations).
    // Downstream auth will enforce org/site membership.
    const sites = await this.tenancy.listActiveSites();
    return (sites ?? []).map((s: any) => ({ id: String(s._id), name: String(s.name ?? 'Sede') }));
  }
}

