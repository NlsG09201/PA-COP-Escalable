import { Body, Controller, Get, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenancyInterceptor } from '../tenancy/tenancy.interceptor';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { PsychologyService } from './psychology.service';
import { CreatePsychologySessionDto } from './dto/create-psychology-session.dto';
import { CreatePsychologicalEvaluationDto } from './dto/create-psychological-evaluation.dto';
import { TenantContext } from '../tenancy/tenancy.interceptor';

@ApiTags('psychology')
@ApiBearerAuth()
@Controller('api/psychology')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class PsychologyController {
  constructor(private readonly psychology: PsychologyService) {}

  @Get('scales/templates')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  scaleTemplates() {
    return this.psychology.listScaleTemplates();
  }

  @Get('dsm/categories')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  dsmCategories() {
    return this.psychology.listDsmCategories();
  }

  @Get('patients/:patientId/sessions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  sessions(@Param('patientId') patientId: string, @Req() req: { tenant: TenantContext }) {
    return this.psychology.listSessions(patientId, req.tenant);
  }

  @Post('patients/:patientId/sessions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  createSession(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePsychologySessionDto,
    @Req() req: { tenant: TenantContext; user: { userId: string } },
  ) {
    return this.psychology.createSession(patientId, dto, req.tenant, req.user.userId);
  }

  @Get('patients/:patientId/evolution')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  evolution(@Param('patientId') patientId: string, @Req() req: { tenant: TenantContext }) {
    return this.psychology.evolutionSeries(patientId, req.tenant);
  }

  @Get('patients/:patientId/evaluations')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  evaluations(@Param('patientId') patientId: string, @Req() req: { tenant: TenantContext }) {
    return this.psychology.listEvaluations(patientId, req.tenant);
  }

  @Post('patients/:patientId/evaluations')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  submitEvaluation(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePsychologicalEvaluationDto,
    @Req() req: { tenant: TenantContext; user: { userId: string } },
  ) {
    return this.psychology.submitEvaluation(patientId, dto, req.tenant, req.user.userId);
  }
}
