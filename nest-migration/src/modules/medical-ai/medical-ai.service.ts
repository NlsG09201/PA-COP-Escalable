import { Inject, Injectable, Optional } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TenantContext } from '../tenancy/tenancy.interceptor';
import { MedicalAiPredictionService } from './medical-ai-prediction.service';
import { MedicalAiAlertsService } from './medical-ai-alerts.service';
import { MedicalAiTimelineService } from './medical-ai-timeline.service';
import { MedicalAiAssistantService } from './medical-ai-assistant.service';
import { MedicalAiInsightsService } from './medical-ai-insights.service';
import { MedicalAiDashboardService } from './medical-ai-dashboard.service';
import { J48ScoringService } from '../j48-scoring/j48-scoring.service';
import { MEDICAL_AI_QUEUE, MedicalAiJobPayload } from './medical-ai.processor';

@Injectable()
export class MedicalAiService {
  constructor(
    private readonly predictions: MedicalAiPredictionService,
    private readonly alerts: MedicalAiAlertsService,
    private readonly timeline: MedicalAiTimelineService,
    private readonly assistant: MedicalAiAssistantService,
    private readonly insights: MedicalAiInsightsService,
    private readonly dashboard: MedicalAiDashboardService,
    private readonly j48: J48ScoringService,
    @Optional()
    @Inject(getQueueToken(MEDICAL_AI_QUEUE))
    private readonly queue?: Queue<MedicalAiJobPayload> | null,
  ) {}

  async assessPatient(patientId: string, tenant: TenantContext, user: { userId: string; roles?: string[] }) {
    await this.j48.scorePatientForUser(patientId, {
      roles: user.roles ?? [],
      organization_id: tenant.organizationId,
      site_id: tenant.siteId,
    });

    const result = await this.predictions.assessPatient(patientId, tenant, tenant.siteId);
    if (!result) return null;

    const alert = await this.alerts.createFromAssessment(tenant, {
      patientId,
      patientName: result.patientName,
      riskLevel: result.prediction.riskLevel,
      ensembleProbability: result.prediction.ensembleProbability,
      recommendations: result.prediction.clinicalRecommendations ?? [],
      siteId: tenant.siteId,
    });

    return { ...result, alert };
  }

  enqueueAssess(patientId: string, tenant: TenantContext) {
    if (!this.queue) {
      return this.assessPatient(patientId, tenant, { userId: 'sync', roles: [] });
    }
    return this.queue.add(
      'assess',
      { type: 'ASSESS_PATIENT', patientId, tenant },
      { removeOnComplete: 100, attempts: 2 },
    );
  }

  enqueueOrgInsights(tenant: TenantContext) {
    if (!this.queue) {
      return this.insights.generateForOrganization(tenant);
    }
    return this.queue.add('insights', { type: 'ORG_INSIGHTS', tenant }, { removeOnComplete: 50 });
  }
}
