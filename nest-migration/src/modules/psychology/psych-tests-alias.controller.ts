import { Body, Controller, Get, Param, Post, UseGuards, Req, UseInterceptors } from '@nestjs/common';
import { TenancyInterceptor } from '../tenancy/tenancy.interceptor';
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
@UseInterceptors(TenancyInterceptor)
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

  @Post('patients/:patientId/submissions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  submit(
    @Param('patientId') patientId: string,
    @Body()
    body: {
      templateId: string;
      score?: number;
      classification?: string;
      answersByQuestionId?: Record<string, string>;
    },
    @Req() req: { tenant: TenantContext; user: { userId: string } },
  ) {
    const responses: Record<string, number> = {};
    for (const [k, v] of Object.entries(body.answersByQuestionId ?? {})) {
      const n = Number(v);
      responses[k] = Number.isFinite(n) ? n : 0;
    }
    return this.psychology.submitEvaluation(
      patientId,
      {
        scaleId: body.templateId,
        responses,
        interpretation: body.classification,
      },
      req.tenant,
      req.user.userId,
    );
  }
}
