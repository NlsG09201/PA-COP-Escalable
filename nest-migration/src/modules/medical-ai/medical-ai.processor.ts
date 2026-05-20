import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MedicalAiPredictionService } from './medical-ai-prediction.service';
import { MedicalAiAlertsService } from './medical-ai-alerts.service';
import { MedicalAiInsightsService } from './medical-ai-insights.service';
import { MedicalAiGateway } from './medical-ai.gateway';
import { TenantContext } from '../tenancy/tenancy.interceptor';

export const MEDICAL_AI_QUEUE = 'medical-ai';

export type MedicalAiJobPayload = {
  type: 'ASSESS_PATIENT' | 'ORG_INSIGHTS';
  patientId?: string;
  tenant: TenantContext;
};

@Processor(MEDICAL_AI_QUEUE)
export class MedicalAiProcessor extends WorkerHost {
  private readonly logger = new Logger(MedicalAiProcessor.name);

  constructor(
    private readonly predictions: MedicalAiPredictionService,
    private readonly alerts: MedicalAiAlertsService,
    private readonly insights: MedicalAiInsightsService,
    private readonly gateway: MedicalAiGateway,
  ) {
    super();
  }

  async process(job: Job<MedicalAiJobPayload>) {
    const { type, tenant, patientId } = job.data;
    if (type === 'ASSESS_PATIENT' && patientId) {
      const result = await this.predictions.assessPatient(patientId, tenant, tenant.siteId);
      if (!result) return { ok: false };
      await this.alerts.createFromAssessment(tenant, {
        patientId,
        patientName: result.patientName,
        riskLevel: result.prediction.riskLevel,
        ensembleProbability: result.prediction.ensembleProbability,
        recommendations: result.prediction.clinicalRecommendations ?? [],
        siteId: tenant.siteId,
      });
      this.logger.log(`Assessed patient ${patientId} risk=${result.prediction.riskLevel}`);
      return { ok: true, patientId, riskLevel: result.prediction.riskLevel };
    }

    if (type === 'ORG_INSIGHTS') {
      const rows = await this.insights.generateForOrganization(tenant);
      for (const row of rows) {
        this.gateway.broadcastInsight(tenant.organizationId, row);
      }
      return { ok: true, insights: rows.length };
    }

    return { ok: false };
  }
}
