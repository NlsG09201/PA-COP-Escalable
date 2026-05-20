import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MedicalAlert } from './schemas/medical-alert.schema';
import { TenantContext } from '../tenancy/tenancy.interceptor';
import { MedicalAiGateway } from './medical-ai.gateway';

@Injectable()
export class MedicalAiAlertsService {
  constructor(
    @InjectModel(MedicalAlert.name) private readonly alerts: Model<MedicalAlert>,
    private readonly gateway: MedicalAiGateway,
  ) {}

  async listOpen(tenant: TenantContext, limit = 50) {
    const filter: Record<string, unknown> = {
      organizationId: tenant.organizationId,
      status: 'OPEN',
    };
    if (tenant.siteId) filter.siteId = tenant.siteId;
    return this.alerts.find(filter).sort({ priorityScore: -1, createdAt: -1 }).limit(limit).lean().exec();
  }

  async createFromAssessment(
    tenant: TenantContext,
    payload: {
      patientId: string;
      patientName: string;
      riskLevel: string;
      ensembleProbability: number;
      recommendations: string[];
      siteId?: string;
    },
  ) {
    const severity = payload.riskLevel;
    const priorityScore = Math.round(payload.ensembleProbability * 100);
    if (priorityScore < 40) return null;

    const alert = await this.alerts.create({
      organizationId: tenant.organizationId,
      siteId: payload.siteId ?? tenant.siteId,
      patientId: payload.patientId,
      patientName: payload.patientName,
      alertType: 'RELAPSE_RISK',
      severity,
      title: `Riesgo de recaída ${severity}`,
      message: `Probabilidad de recaída ${(payload.ensembleProbability * 100).toFixed(1)}% detectada por motor ensemble (J48 + RF + XGBoost).`,
      recommendations: payload.recommendations,
      priorityScore,
      status: 'OPEN',
      metadata: { ensembleProbability: payload.ensembleProbability },
    });

    const plain = alert.toObject();
    this.gateway.broadcastAlert(tenant.organizationId, {
      id: String(plain._id),
      ...plain,
    });
    return plain;
  }

  async createInsightAlert(
    tenant: TenantContext,
    payload: {
      patientId?: string;
      patientName?: string;
      title: string;
      message: string;
      severity: string;
      recommendations?: string[];
    },
  ) {
    const alert = await this.alerts.create({
      organizationId: tenant.organizationId,
      siteId: tenant.siteId,
      patientId: payload.patientId ?? 'ORG_WIDE',
      patientName: payload.patientName ?? 'Organización',
      alertType: 'AI_INSIGHT',
      severity: payload.severity,
      title: payload.title,
      message: payload.message,
      recommendations: payload.recommendations ?? [],
      priorityScore: payload.severity === 'CRITICAL' ? 95 : payload.severity === 'HIGH' ? 75 : 50,
      status: 'OPEN',
    });
    const plain = alert.toObject();
    this.gateway.broadcastAlert(tenant.organizationId, { id: String(plain._id), ...plain });
    return plain;
  }

  async acknowledge(alertId: string, tenant: TenantContext, userId: string) {
    return this.alerts
      .findOneAndUpdate(
        { _id: alertId, organizationId: tenant.organizationId, status: 'OPEN' },
        { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedByUserId: userId },
        { new: true },
      )
      .lean()
      .exec();
  }
}
