import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Patient } from '../patients/patient.schema';
import { Appointment, AppointmentStatus } from '../appointments/schemas/appointment.schema';
import { PsychologySession } from '../psychology/schemas/psychology-session.schema';
import { PsychologicalEvaluation } from '../psychology/schemas/psychological-evaluation.schema';
import { J48Prediction } from '../j48-scoring/schemas/j48-prediction.schema';
import { MedicalAiPrediction } from './schemas/medical-ai-prediction.schema';
import { TenantContext } from '../tenancy/tenancy.interceptor';

@Injectable()
export class MedicalAiPredictionService {
  constructor(
    @InjectModel(Patient.name) private readonly patients: Model<Patient>,
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(PsychologySession.name) private readonly sessions: Model<PsychologySession>,
    @InjectModel(PsychologicalEvaluation.name) private readonly evaluations: Model<PsychologicalEvaluation>,
    @InjectModel(J48Prediction.name) private readonly j48Predictions: Model<J48Prediction>,
    @InjectModel(MedicalAiPrediction.name) private readonly predictions: Model<MedicalAiPrediction>,
  ) {}

  async buildFeatureVector(patientId: string, tenant: TenantContext): Promise<Record<string, number>> {
    const orgId = tenant.organizationId;
    const now = new Date();
    const since90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const sessionRows = await this.sessions
      .find({ patientId, organizationId: orgId, occurredAt: { $gte: since90 } })
      .sort({ occurredAt: -1 })
      .limit(40)
      .lean()
      .exec();

    const evalRows = await this.evaluations
      .find({ patientId, organizationId: orgId })
      .sort({ evaluatedAt: -1 })
      .limit(20)
      .lean()
      .exec();

    const lastSession = sessionRows[0];
    const daysSinceLast = lastSession?.occurredAt
      ? Math.max(
          0,
          Math.floor((now.getTime() - new Date(lastSession.occurredAt).getTime()) / (86400000)),
        )
      : 120;

    const completed90 = await this.appointments.countDocuments({
      patient_id: patientId,
      organization_id: orgId,
      status: AppointmentStatus.COMPLETED,
      end_at: { $gte: since90 },
    });

    const anxietyScores: number[] = [];
    const depressionScores: number[] = [];
    const stressScores: number[] = [];
    let negativeCount = 0;

    for (const s of sessionRows) {
      const emo = (s.emotionalState ?? {}) as Record<string, unknown>;
      const scales = (s.scaleScores ?? {}) as Record<string, number>;
      if (typeof emo.anxiety === 'number') anxietyScores.push(emo.anxiety as number);
      if (typeof emo.depression === 'number') depressionScores.push(emo.depression as number);
      if (typeof emo.stress === 'number') stressScores.push(emo.stress as number);
      if (String(emo.valence ?? '').toLowerCase().includes('neg')) negativeCount += 1;
      if (typeof scales.GAD7 === 'number') anxietyScores.push(scales.GAD7 / 21);
      if (typeof scales.PHQ9 === 'number') depressionScores.push(scales.PHQ9 / 27);
      if (typeof scales.PSS10 === 'number') stressScores.push(scales.PSS10 / 40);
    }

    for (const e of evalRows) {
      const total = Number(e.totalScore ?? 0);
      if (e.scaleId === 'GAD7') anxietyScores.push(total / 21);
      if (e.scaleId === 'PHQ9') depressionScores.push(total / 27);
      if (e.scaleId === 'PSS10') stressScores.push(total / 40);
    }

    const avg = (arr: number[], fallback: number) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : fallback;

    const priorRelapse = sessionRows.some((s) =>
      (s.tags ?? []).some((t) => String(t).toLowerCase().includes('relapse')),
    )
      ? 1
      : 0;

    return {
      anxiety: Math.min(1, avg(anxietyScores, 0.45)),
      depression: Math.min(1, avg(depressionScores, 0.4)),
      stress: Math.min(1, avg(stressScores, 0.35)),
      adherence: completed90 >= 2 ? 0.85 : completed90 === 1 ? 0.55 : 0.25,
      attendance_irregular: completed90 < 1 ? 1 : 0,
      days_since_last_session: Math.min(180, daysSinceLast) / 180,
      negative_emotion_ratio: sessionRows.length ? negativeCount / sessionRows.length : 0.3,
      session_count_90d: Math.min(24, sessionRows.length) / 24,
      scale_severity_avg: Math.min(1, (avg(anxietyScores, 0.3) + avg(depressionScores, 0.3)) / 2),
      prior_relapse: priorRelapse,
    };
  }

  private j48RiskFromLabel(label: string): number {
    const n = String(label ?? '').toUpperCase();
    if (n.includes('CRIT') || n.includes('HIGH') || n.includes('ALTO')) return 88;
    if (n.includes('MED') || n.includes('MODER')) return 58;
    if (n.includes('LOW') || n.includes('BAJO')) return 22;
    return 45;
  }

  async callEnsemble(
    patientId: string,
    tenant: TenantContext,
    features: Record<string, number>,
    j48RiskScore: number,
  ) {
    const base = (process.env.AI_RELAPSE_URL ?? 'http://recommendation-engine:8000').replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/api/medical/ensemble/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          organization_id: tenant.organizationId,
          features,
          j48_risk_score: j48RiskScore,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`ensemble predict failed (${res.status}): ${text}`);
      }
      return res.json();
    } catch (err) {
      return this.localEnsembleFallback(features, j48RiskScore);
    }
  }

  /** Cuando recommendation-engine no está en Render, estima riesgo desde features + J48. */
  private localEnsembleFallback(features: Record<string, number>, j48RiskScore: number) {
    const stress =
      (features.anxiety ?? 0.4) * 0.35 +
      (features.depression ?? 0.4) * 0.4 +
      (features.stress ?? 0.35) * 0.25;
    const dropout =
      (features.attendance_irregular ?? 0) * 0.5 +
      (features.days_since_last_session ?? 0) * 0.35 +
      (1 - (features.adherence ?? 0.5)) * 0.15;
    const blended = Math.min(1, Math.max(0, j48RiskScore / 100 * 0.55 + stress * 0.3 + dropout * 0.15));
    const risk_level =
      blended >= 0.75 ? 'CRITICAL' : blended >= 0.55 ? 'HIGH' : blended >= 0.35 ? 'MEDIUM' : 'LOW';
    return {
      ensemble_probability: blended,
      risk_level,
      dynamic_psychological_score: Math.round((1 - stress) * 100),
      model_votes: [{ model: 'local-fallback', relapseProbability: blended, riskLevel: risk_level }],
      clinical_recommendations: [
        'Motor ensemble remoto no disponible; score calculado en el API Nest.',
        'Despliega recommendation-engine o AI_RELAPSE_URL en Render para votación completa.',
      ],
      early_warning: blended >= 0.55,
      confidence: 0.55,
    };
  }

  computeRiskScores(ensembleProb: number, features: Record<string, number>) {
    const relapseRisk = Math.round(ensembleProb * 100);
    const mentalHealth = Math.round((1 - (features.anxiety * 0.35 + features.depression * 0.4 + features.stress * 0.25)) * 100);
    const adherence = Math.round((features.adherence ?? 0.5) * 100);
    const dropoutRisk = Math.round(
      (features.attendance_irregular * 0.5 + features.days_since_last_session * 0.35 + (1 - features.adherence) * 0.15) * 100,
    );
    const urgency = Math.round(Math.max(relapseRisk, dropoutRisk) * 0.85 + (100 - mentalHealth) * 0.15);
    return { mentalHealth, relapseRisk, adherence, dropoutRisk, urgency };
  }

  async assessPatient(patientId: string, tenant: TenantContext, siteId?: string) {
    const patient = await this.patients
      .findOne({ _id: patientId, organization_id: tenant.organizationId })
      .lean()
      .exec();
    if (!patient) return null;

    const features = await this.buildFeatureVector(patientId, tenant);
    const latestJ48 = await this.j48Predictions
      .findOne({ patientId, organizationId: tenant.organizationId })
      .sort({ scoredAt: -1 })
      .lean()
      .exec();
    const j48Risk = latestJ48 ? this.j48RiskFromLabel(String(latestJ48.classLabel ?? '')) : 45;

    const ensemble = await this.callEnsemble(patientId, tenant, features, j48Risk);
    const scores = this.computeRiskScores(Number(ensemble.ensemble_probability ?? 0.5), features);

    const doc = await this.predictions.create({
      organizationId: tenant.organizationId,
      siteId: siteId ?? tenant.siteId,
      patientId,
      ensembleProbability: ensemble.ensemble_probability,
      riskLevel: ensemble.risk_level,
      dynamicPsychologicalScore: ensemble.dynamic_psychological_score,
      modelVotes: ensemble.model_votes ?? [],
      clinicalRecommendations: ensemble.clinical_recommendations ?? [],
      earlyWarning: Boolean(ensemble.early_warning),
      confidence: Number(ensemble.confidence ?? 0.7),
      featureSnapshot: features,
      scores,
    });

    return {
      prediction: doc.toObject(),
      patientName: String((patient as { full_name?: string }).full_name ?? 'Paciente'),
      ensemble,
      scores,
    };
  }

  async latestForPatient(patientId: string, tenant: TenantContext) {
    return this.predictions
      .findOne({ patientId, organizationId: tenant.organizationId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async historyForPatient(patientId: string, tenant: TenantContext, limit = 24) {
    return this.predictions
      .find({ patientId, organizationId: tenant.organizationId })
      .sort({ createdAt: -1 })
      .limit(Math.min(100, limit))
      .lean()
      .exec();
  }
}
