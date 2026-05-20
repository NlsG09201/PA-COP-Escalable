import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { PsychologyService } from './psychology.service';
import { TenantContext } from '../tenancy/tenancy.interceptor';

@ApiTags('psych-tests')
@ApiBearerAuth()
@Controller('api/psych-tests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PsychTestsAliasController {
  constructor(private readonly psychology: PsychologyService) {}

  @Get('templates')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  templates() {
    return this.psychology.listScaleTemplates();
  }

  @Get('patients/:patientId/submissions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  submissions(@Param('patientId') patientId: string, @Req() req: { tenant: TenantContext }) {
    return this.psychology.listEvaluations(patientId, req.tenant);
  }
}
