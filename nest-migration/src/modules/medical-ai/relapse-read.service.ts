import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantContext } from '../tenancy/tenancy.interceptor';
import { MedicalAiPrediction } from './schemas/medical-ai-prediction.schema';
import { MedicalAlert } from './schemas/medical-alert.schema';
import { J48Prediction } from '../j48-scoring/schemas/j48-prediction.schema';

export type RelapseAlertDto = {
  id: string;
  patientId: string;
  riskScore: number;
  riskLevel: string;
  factors: Array<{ factor: string; weight: number; description: string }>;
  actions: string[];
  acknowledged: boolean;
  createdAt: string;
};

@Injectable()
export class RelapseReadService {
  constructor(
    @InjectModel(MedicalAiPrediction.name) private readonly predictions: Model<MedicalAiPrediction>,
    @InjectModel(MedicalAlert.name) private readonly alerts: Model<MedicalAlert>,
    @InjectModel(J48Prediction.name) private readonly j48Predictions: Model<J48Prediction>,
  ) {}

  async getLatestRisk(patientId: string, tenant: TenantContext): Promise<RelapseAlertDto> {
    const pred = await this.predictions
      .findOne({ patientId, organizationId: tenant.organizationId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (pred) {
      return this.fromPrediction(patientId, pred);
    }

    const j48 = await this.j48Predictions
      .findOne({ patientId, organizationId: tenant.organizationId })
      .sort({ scoredAt: -1 })
      .lean()
      .exec();

    if (j48) {
      return this.fromJ48(patientId, j48);
    }

    const openAlert = await this.alerts
      .findOne({
        patientId,
        organizationId: tenant.organizationId,
        alertType: 'RELAPSE_RISK',
        status: 'OPEN',
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (openAlert) {
      return this.fromAlert(patientId, openAlert);
    }

    return this.emptyRisk(patientId);
  }

  async getTrend(patientId: string, tenant: TenantContext, limit = 24): Promise<RelapseAlertDto[]> {
    const preds = await this.predictions
      .find({ patientId, organizationId: tenant.organizationId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    if (preds.length) {
      return preds.map((p) => this.fromPrediction(patientId, p)).reverse();
    }

    const j48Rows = await this.j48Predictions
      .find({ patientId, organizationId: tenant.organizationId })
      .sort({ scoredAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    if (j48Rows.length) {
      return j48Rows.map((j) => this.fromJ48(patientId, j)).reverse();
    }

    return [];
  }

  private fromPrediction(patientId: string, pred: Record<string, unknown>): RelapseAlertDto {
    const scores = (pred.scores as Record<string, number>) ?? {};
    const features = (pred.featureSnapshot as Record<string, number>) ?? {};
    const level = String(pred.riskLevel ?? 'MEDIUM');
    return {
      id: String(pred._id ?? patientId),
      patientId,
      riskScore: Number(scores.relapseRisk ?? Math.round(Number(pred.ensembleProbability ?? 0.5) * 100)),
      riskLevel: level,
      factors: this.factorsFromFeatures(features),
      actions: Array.isArray(pred.clinicalRecommendations)
        ? (pred.clinicalRecommendations as string[])
        : [],
      acknowledged: false,
      createdAt: this.iso(pred.createdAt),
    };
  }

  private fromJ48(patientId: string, row: Record<string, unknown>): RelapseAlertDto {
    const label = String(row.classLabel ?? 'MEDIUM');
    const level = this.levelFromLabel(label);
    const score = this.scoreFromLevel(level);
    return {
      id: String(row._id ?? patientId),
      patientId,
      riskScore: score,
      riskLevel: level,
      factors: [{ factor: 'J48', weight: 1, description: `Clase del árbol: ${label}` }],
      actions: ['Revisar evolución en sesiones de psicología', 'Considerar evaluación ensemble cuando el motor IA esté activo'],
      acknowledged: false,
      createdAt: this.iso(row.scoredAt ?? row.createdAt),
    };
  }

  private fromAlert(patientId: string, alert: Record<string, unknown>): RelapseAlertDto {
    const meta = (alert.metadata as Record<string, number>) ?? {};
    const prob = Number(meta.ensembleProbability ?? 0.5);
    return {
      id: String(alert._id ?? patientId),
      patientId,
      riskScore: Number(alert.priorityScore ?? Math.round(prob * 100)),
      riskLevel: String(alert.severity ?? 'MEDIUM'),
      factors: [],
      actions: Array.isArray(alert.recommendations) ? (alert.recommendations as string[]) : [],
      acknowledged: alert.status === 'ACKNOWLEDGED',
      createdAt: this.iso(alert.createdAt),
    };
  }

  private emptyRisk(patientId: string): RelapseAlertDto {
    return {
      id: `pending-${patientId}`,
      patientId,
      riskScore: 0,
      riskLevel: 'UNKNOWN',
      factors: [],
      actions: ['Ejecutar Evaluar J48 o Evaluar compat. para generar el primer score'],
      acknowledged: false,
      createdAt: new Date().toISOString(),
    };
  }

  private factorsFromFeatures(features: Record<string, number>) {
    const out: RelapseAlertDto['factors'] = [];
    const push = (factor: string, raw: number, description: string) => {
      if (!Number.isFinite(raw)) return;
      out.push({ factor, weight: Math.round(raw * 100) / 100, description });
    };
    push('Ansiedad', features.anxiety, 'Nivel de ansiedad inferido de sesiones');
    push('Depresión', features.depression, 'Indicadores depresivos');
    push('Adherencia', features.adherence, 'Asistencia y cumplimiento');
    push('Días sin sesión', features.days_since_last_session, 'Tiempo desde última cita');
    return out;
  }

  private levelFromLabel(label: string): string {
    const n = label.toUpperCase();
    if (n.includes('CRIT')) return 'CRITICAL';
    if (n.includes('HIGH') || n.includes('ALTO')) return 'HIGH';
    if (n.includes('LOW') || n.includes('BAJO')) return 'LOW';
    if (n.includes('MED') || n.includes('MODER')) return 'MEDIUM';
    return 'MEDIUM';
  }

  private scoreFromLevel(level: string): number {
    switch (level) {
      case 'CRITICAL':
        return 92;
      case 'HIGH':
        return 78;
      case 'LOW':
        return 22;
      case 'MEDIUM':
        return 52;
      default:
        return 0;
    }
  }

  private iso(value: unknown): string {
    if (!value) return new Date().toISOString();
    const d = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
}
