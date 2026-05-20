import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Appointment, AppointmentStatus } from '../appointments/schemas/appointment.schema';
import { MedicalAiPrediction } from './schemas/medical-ai-prediction.schema';
import { MedicalAlert } from './schemas/medical-alert.schema';
import { TenantContext } from '../tenancy/tenancy.interceptor';

@Injectable()
export class MedicalAiDashboardService {
  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(MedicalAiPrediction.name) private readonly predictions: Model<MedicalAiPrediction>,
    @InjectModel(MedicalAlert.name) private readonly alerts: Model<MedicalAlert>,
  ) {}

  async predictiveKpis(tenant: TenantContext, fromIso: string, toIso: string) {
    const orgId = tenant.organizationId;
    const from = new Date(fromIso);
    const to = new Date(toIso);

    const openAlerts = await this.alerts.countDocuments({
      organizationId: orgId,
      status: 'OPEN',
    });

    const highRiskPatients = await this.predictions
      .aggregate([
        {
          $match: {
            organizationId: orgId,
            createdAt: { $gte: from, $lte: to },
            riskLevel: { $in: ['HIGH', 'CRITICAL'] },
          },
        },
        { $group: { _id: '$patientId' } },
        { $count: 'total' },
      ])
      .exec();

    const avgRelapse = await this.predictions
      .aggregate([
        { $match: { organizationId: orgId, createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: null, avg: { $avg: '$ensembleProbability' } } },
      ])
      .exec();

    const scheduled = await this.appointments.countDocuments({
      organization_id: orgId,
      start_at: { $gte: from, $lte: to },
      status: { $in: [AppointmentStatus.CONFIRMED, AppointmentStatus.REQUESTED] },
    });

    const completed = await this.appointments.countDocuments({
      organization_id: orgId,
      start_at: { $gte: from, $lte: to },
      status: AppointmentStatus.COMPLETED,
    });

    const cancelled = await this.appointments.countDocuments({
      organization_id: orgId,
      start_at: { $gte: from, $lte: to },
      status: AppointmentStatus.CANCELLED,
    });

    const saturationIndex = scheduled > 0 ? Math.min(100, Math.round((scheduled / Math.max(completed, 1)) * 40)) : 0;
    const predictedNoShowRate =
      scheduled > 0 ? Math.round((cancelled / (scheduled + cancelled + completed)) * 100) : 0;

    const riskTrend = await this.predictions
      .aggregate([
        { $match: { organizationId: orgId, createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: { $dateTrunc: { date: '$createdAt', unit: 'day', timezone: 'UTC' } },
            avgRisk: { $avg: '$ensembleProbability' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            bucket: { $dateToString: { date: '$_id', format: '%Y-%m-%d', timezone: 'UTC' } },
            avgRisk: { $round: [{ $multiply: ['$avgRisk', 100] }, 1] },
            assessments: '$count',
          },
        },
      ])
      .exec();

    const heatmap = await this.predictions
      .aggregate([
        { $match: { organizationId: orgId, createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: '$riskLevel',
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, riskLevel: '$_id', count: 1 } },
      ])
      .exec();

    return {
      openAlerts,
      highRiskPatientCount: highRiskPatients[0]?.total ?? 0,
      averageRelapseProbabilityPct: Math.round((avgRelapse[0]?.avg ?? 0) * 1000) / 10,
      predictedNoShowRatePct: predictedNoShowRate,
      scheduleSaturationIndex: saturationIndex,
      medicalLoadForecast: Math.round(scheduled * (1 + predictedNoShowRate / 200)),
      riskTrendSeries: riskTrend,
      riskHeatmap: heatmap,
      period: { from: fromIso, to: toIso },
    };
  }

  async recommendationsForPatient(patientId: string, tenant: TenantContext) {
    const latest = await this.predictions
      .findOne({ patientId, organizationId: tenant.organizationId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    if (!latest) {
      return {
        sessionFrequency: 'Evaluar con primera predicción IA',
        priorityFollowUp: false,
        therapyAdjustments: ['Ejecutar evaluación ensemble'],
        dentalReview: 'Revisión odontológica según agenda',
        preventiveActions: ['Registrar escalas GAD-7 y PHQ-9'],
      };
    }

    const risk = latest.riskLevel;
    const freq =
      risk === 'CRITICAL' || risk === 'HIGH'
        ? '2 sesiones por semana'
        : risk === 'MEDIUM'
          ? '1 sesión semanal'
          : '1 sesión quincenal';

    return {
      sessionFrequency: freq,
      priorityFollowUp: risk === 'HIGH' || risk === 'CRITICAL',
      therapyAdjustments: latest.clinicalRecommendations ?? [],
      dentalReview: risk === 'HIGH' ? 'Priorizar control odontológico por estrés somático' : 'Control rutinario',
      preventiveActions: [
        'Monitoreo de adherencia terapéutica',
        'Reevaluación ensemble en 14 días',
        ...(latest.earlyWarning ? ['Alerta temprana activa'] : []),
      ],
      scores: latest.scores,
    };
  }
}
