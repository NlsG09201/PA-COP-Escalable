import { Controller, Get, Query, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenancyService } from './tenancy.service';

function isMongoUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /buffering timed out|ServerSelection|whitelist|ECONNREFUSED|not connected/i.test(msg);
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
        throw new ServiceUnavailableException(
          'Base de datos no disponible. Revisa MongoDB Atlas (Network Access 0.0.0.0/0) y variables en Render.',
        );
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
        throw new ServiceUnavailableException(
          'Base de datos no disponible. Revisa MongoDB Atlas (Network Access 0.0.0.0/0) y variables en Render.',
        );
      }
      throw err;
    }
  }
}

