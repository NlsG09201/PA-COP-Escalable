import { Controller, Get, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { TenancyInterceptor } from '../tenancy/tenancy.interceptor';
import { OdontologyService } from './odontology.service';

@ApiTags('odontology')
@ApiBearerAuth()
@Controller('api/odontology')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class OdontologyController {
  constructor(private readonly service: OdontologyService) {}

  @Get('patients/:patientId/plans')
  @Roles('ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL')
  async patientPlans(@Param('patientId') patientId: string, @Req() req) {
    return this.service.listPlansForPatient(patientId, req.tenant);
  }

  @Post('patients/:patientId/suggest-plan')
  @Roles('ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL')
  async suggestPlan(@Param('patientId') patientId: string, @Req() req) {
    return this.service.suggestPlanForPatient(patientId, req.tenant);
  }
}

