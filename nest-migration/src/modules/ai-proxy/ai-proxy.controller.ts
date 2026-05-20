import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { AiProxyService } from './ai-proxy.service';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiProxyController {
  constructor(private readonly ai: AiProxyService) {}

  @Get('diagnosis/patients/:patientId/results')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'ODONTOLOGO', 'PSICOLOGO')
  diagnosis(@Param('patientId') patientId: string) {
    return this.ai.diagnosisResults(patientId);
  }

  @Get('emotion/patients/:patientId/results')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'ODONTOLOGO', 'PSICOLOGO')
  emotion(@Param('patientId') patientId: string) {
    return this.ai.emotionResults(patientId);
  }

  @Get('relapse/patients/:patientId/risk')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  relapseRisk(@Param('patientId') patientId: string) {
    return this.ai.relapseRisk(patientId);
  }

  @Get('relapse/patients/:patientId/trend')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  relapseTrend(@Param('patientId') patientId: string) {
    return this.ai.relapseTrend(patientId);
  }

  @Get('therapy/modules')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  therapyModules() {
    return this.ai.therapyModules();
  }

  @Get('j48/model/tree')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  j48Tree() {
    return this.ai.j48Tree();
  }
}
