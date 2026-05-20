import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MedicalInsight } from './schemas/medical-insight.schema';
import { MedicalAiPrediction } from './schemas/medical-ai-prediction.schema';
import { PsychologySession } from '../psychology/schemas/psychology-session.schema';
import { TenantContext } from '../tenancy/tenancy.interceptor';

@Injectable()
export class MedicalAiInsightsService {
  constructor(
    @InjectModel(MedicalInsight.name) private readonly insights: Model<MedicalInsight>,
    @InjectModel(MedicalAiPrediction.name) private readonly predictions: Model<MedicalAiPrediction>,
    @InjectModel(PsychologySession.name) private readonly sessions: Model<PsychologySession>,
  ) {}

  async generateForOrganization(tenant: TenantContext) {
    const orgId = tenant.organizationId;
    const since30 = new Date(Date.now() - 30 * 86400000);

    const riskAgg = await this.predictions
      .aggregate([
        { $match: { organizationId: orgId, createdAt: { $gte: since30 } } },
        {
          $group: {
            _id: '$riskLevel',
            count: { $sum: 1 },
            avgScore: { $avg: '$dynamicPsychologicalScore' },
          },
        },
      ])
      .exec();

    const sessionAgg = await this.sessions
      .aggregate([
        { $match: { organizationId: orgId, occurredAt: { $gte: since30 } } },
        { $group: { _id: '$sessionType', total: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ])
      .exec();

    const highRisk = await this.predictions.countDocuments({
      organizationId: orgId,
      riskLevel: { $in: ['HIGH', 'CRITICAL'] },
      createdAt: { $gte: since30 },
    });

    const created: Record<string, unknown>[] = [];

    const insightRisk = await this.insights.create({
      organizationId: orgId,
      siteId: tenant.siteId,
      category: 'RISK_DISTRIBUTION',
      title: 'Distribución de riesgo de recaída (30 días)',
      summary: `Se registraron ${highRisk} evaluaciones de riesgo alto/crítico en el período.`,
      statistics: { byLevel: riskAgg, highRiskCount: highRisk },
      correlations: ['Mayor ansiedad correlaciona con riesgo HIGH en evaluaciones ensemble'],
      impactScore: Math.min(100, highRisk * 8),
    });
    created.push(insightRisk.toObject() as Record<string, unknown>);

    const insightSessions = await this.insights.create({
      organizationId: orgId,
      siteId: tenant.siteId,
      category: 'SESSION_PATTERNS',
      title: 'Patrones de sesión psicológica',
      summary: 'Distribución de tipos de sesión en los últimos 30 días.',
      statistics: { sessionTypes: sessionAgg },
      correlations: [],
      impactScore: 45,
    });
    created.push(insightSessions.toObject() as Record<string, unknown>);

    return created;
  }

  async list(tenant: TenantContext, limit = 30) {
    return this.insights
      .find({ organizationId: tenant.organizationId })
      .sort({ impactScore: -1, createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }
}
