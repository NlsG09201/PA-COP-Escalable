import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { TenancyInterceptor, TenantContext } from '../tenancy/tenancy.interceptor';
import { MedicalAiService } from './medical-ai.service';
import { MedicalAiPredictionService } from './medical-ai-prediction.service';
import { MedicalAiAlertsService } from './medical-ai-alerts.service';
import { MedicalAiTimelineService } from './medical-ai-timeline.service';
import { MedicalAiAssistantService } from './medical-ai-assistant.service';
import { MedicalAiInsightsService } from './medical-ai-insights.service';
import { MedicalAiDashboardService } from './medical-ai-dashboard.service';
import { RelapseReadService } from './relapse-read.service';
import { AssistantChatDto } from './dto/assistant-chat.dto';

@ApiTags('medical-ai')
@ApiBearerAuth()
@Controller('api/medical-ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class MedicalAiController {
  constructor(
    private readonly medicalAi: MedicalAiService,
    private readonly predictions: MedicalAiPredictionService,
    private readonly alerts: MedicalAiAlertsService,
    private readonly timeline: MedicalAiTimelineService,
    private readonly assistant: MedicalAiAssistantService,
    private readonly insights: MedicalAiInsightsService,
    private readonly dashboard: MedicalAiDashboardService,
  ) {}

  @Get('dashboard/predictive')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO', 'ODONTOLOGO')
  predictiveDashboard(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: { tenant: TenantContext },
  ) {
    const toDate = to || new Date().toISOString();
    const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString();
    return this.dashboard.predictiveKpis(req.tenant, fromDate, toDate);
  }

  @Get('alerts')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO', 'ODONTOLOGO')
  listAlerts(@Req() req: { tenant: TenantContext }, @Query('limit') limit?: string) {
    return this.alerts.listOpen(req.tenant, limit ? Number(limit) : 50);
  }

  @Put('alerts/:alertId/acknowledge')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  acknowledgeAlert(
    @Param('alertId') alertId: string,
    @Req() req: { tenant: TenantContext; user: { userId: string } },
  ) {
    return this.alerts.acknowledge(alertId, req.tenant, req.user.userId);
  }

  @Post('patients/:patientId/assess')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  assessPatient(
    @Param('patientId') patientId: string,
    @Req() req: { tenant: TenantContext; user: { userId: string; roles?: string[] } },
  ) {
    return this.medicalAi.assessPatient(patientId, req.tenant, req.user);
  }

  @Post('patients/:patientId/assess/async')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  assessAsync(@Param('patientId') patientId: string, @Req() req: { tenant: TenantContext }) {
    return this.medicalAi.enqueueAssess(patientId, req.tenant);
  }

  @Get('patients/:patientId/prediction/latest')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO', 'ODONTOLOGO')
  latestPrediction(@Param('patientId') patientId: string, @Req() req: { tenant: TenantContext }) {
    return this.predictions.latestForPatient(patientId, req.tenant);
  }

  @Get('patients/:patientId/prediction/history')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  predictionHistory(
    @Param('patientId') patientId: string,
    @Query('limit') limit: string,
    @Req() req: { tenant: TenantContext },
  ) {
    return this.predictions.historyForPatient(patientId, req.tenant, limit ? Number(limit) : 24);
  }

  @Get('patients/:patientId/timeline')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO', 'ODONTOLOGO')
  patientTimeline(@Param('patientId') patientId: string, @Req() req: { tenant: TenantContext }) {
    return this.timeline.buildTimeline(patientId, req.tenant);
  }

  @Get('patients/:patientId/recommendations')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO', 'ODONTOLOGO')
  recommendations(@Param('patientId') patientId: string, @Req() req: { tenant: TenantContext }) {
    return this.dashboard.recommendationsForPatient(patientId, req.tenant);
  }

  @Post('patients/:patientId/assistant/chat')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  assistantChat(
    @Param('patientId') patientId: string,
    @Body() dto: AssistantChatDto,
    @Req() req: { tenant: TenantContext; user: { userId: string } },
  ) {
    return this.assistant.chat(patientId, req.tenant, req.user.userId, dto.message);
  }

  @Get('patients/:patientId/assistant/summary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  assistantSummary(
    @Param('patientId') patientId: string,
    @Req() req: { tenant: TenantContext; user: { userId: string } },
  ) {
    return this.assistant.summarize(patientId, req.tenant, req.user.userId);
  }

  @Get('patients/priority')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  priorityPatients(@Req() req: { tenant: TenantContext }, @Query('limit') limit?: string) {
    return this.assistant.prioritizePatients(req.tenant, limit ? Number(limit) : 15);
  }

  @Get('insights')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  listInsights(@Req() req: { tenant: TenantContext }) {
    return this.insights.list(req.tenant);
  }

  @Post('insights/generate')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN')
  generateInsights(@Req() req: { tenant: TenantContext }) {
    return this.insights.generateForOrganization(req.tenant);
  }
}

@ApiTags('relapse')
@ApiBearerAuth()
@Controller('api/relapse')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class RelapseCompatController {
  constructor(
    private readonly medicalAi: MedicalAiService,
    private readonly alerts: MedicalAiAlertsService,
    private readonly relapseRead: RelapseReadService,
  ) {}

  @Get('patients/:patientId/risk')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  risk(@Param('patientId') patientId: string, @Req() req: { tenant: TenantContext }) {
    return this.relapseRead.getLatestRisk(patientId, req.tenant);
  }

  @Get('patients/:patientId/trend')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  trend(@Param('patientId') patientId: string, @Req() req: { tenant: TenantContext }) {
    return this.relapseRead.getTrend(patientId, req.tenant);
  }

  @Put('alerts/:alertId/acknowledge')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  acknowledgeByAlertId(
    @Param('alertId') alertId: string,
    @Req() req: { tenant: TenantContext; user: { userId: string } },
  ) {
    return this.alerts.acknowledge(alertId, req.tenant, req.user.userId);
  }

  @Post('patients/:patientId/assess')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  async assess(
    @Param('patientId') patientId: string,
    @Req() req: { tenant: TenantContext; user: { userId: string; roles?: string[] } },
  ) {
    await this.medicalAi.assessPatient(patientId, req.tenant, req.user);
    return this.relapseRead.getLatestRisk(patientId, req.tenant);
  }

  @Put('patients/:patientId/alerts/:alertId/acknowledge')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  acknowledge(
    @Param('alertId') alertId: string,
    @Req() req: { tenant: TenantContext; user: { userId: string } },
  ) {
    return this.alerts.acknowledge(alertId, req.tenant, req.user.userId);
  }
}
