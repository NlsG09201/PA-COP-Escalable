import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PsychologySession } from '../psychology/schemas/psychology-session.schema';
import { PsychologicalEvaluation } from '../psychology/schemas/psychological-evaluation.schema';
import { Appointment } from '../appointments/schemas/appointment.schema';
import { ClinicalRecord } from '../clinical/schemas/clinical-record.schema';
import { J48Prediction } from '../j48-scoring/schemas/j48-prediction.schema';
import { MedicalAiPrediction } from './schemas/medical-ai-prediction.schema';
import { TenantContext } from '../tenancy/tenancy.interceptor';

export type TimelineEvent = {
  id: string;
  at: string;
  domain: 'PSYCHOLOGY' | 'DENTAL' | 'AI' | 'CLINICAL' | 'APPOINTMENT';
  title: string;
  summary: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  riskMarker?: string;
  aiDetected?: boolean;
};

@Injectable()
export class MedicalAiTimelineService {
  constructor(
    @InjectModel(PsychologySession.name) private readonly sessions: Model<PsychologySession>,
    @InjectModel(PsychologicalEvaluation.name) private readonly evaluations: Model<PsychologicalEvaluation>,
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(ClinicalRecord.name) private readonly clinical: Model<ClinicalRecord>,
    @InjectModel(J48Prediction.name) private readonly j48: Model<J48Prediction>,
    @InjectModel(MedicalAiPrediction.name) private readonly aiPredictions: Model<MedicalAiPrediction>,
  ) {}

  private detectTrend(events: TimelineEvent[]): {
    trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    futureRisk: string;
    correlations: string[];
  } {
    const psych = events.filter((e) => e.domain === 'PSYCHOLOGY' || e.domain === 'AI');
    const negative = psych.filter((e) => e.sentiment === 'negative').length;
    const positive = psych.filter((e) => e.sentiment === 'positive').length;
    let trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' = 'STABLE';
    if (negative > positive + 1) trend = 'DETERIORATING';
    if (positive > negative + 1) trend = 'IMPROVING';

    const aiRisk = events.filter((e) => e.aiDetected && e.riskMarker);
    const futureRisk =
      aiRisk.length && String(aiRisk[0].riskMarker).match(/CRIT|HIGH/)
        ? 'Elevado en próximas 4 semanas'
        : 'Moderado';

    const correlations: string[] = [];
    if (events.some((e) => e.domain === 'DENTAL') && negative > 0) {
      correlations.push('Posible correlación entre estrés emocional y tratamientos odontológicos prolongados');
    }
    if (psych.length >= 3 && negative >= 2) {
      correlations.push('Patrón de deterioro emocional en sesiones recientes');
    }

    return { trend, futureRisk, correlations };
  }

  async buildTimeline(patientId: string, tenant: TenantContext): Promise<{
    events: TimelineEvent[];
    analysis: ReturnType<MedicalAiTimelineService['detectTrend']>;
  }> {
    const orgId = tenant.organizationId;
    const events: TimelineEvent[] = [];

    const sessions = await this.sessions
      .find({ patientId, organizationId: orgId })
      .sort({ occurredAt: -1 })
      .limit(60)
      .lean()
      .exec();

    for (const s of sessions) {
      const emo = (s.emotionalState ?? {}) as Record<string, unknown>;
      const valence = String(emo.valence ?? emo.mood ?? 'neutral').toLowerCase();
      const sentiment = valence.includes('pos')
        ? 'positive'
        : valence.includes('neg')
          ? 'negative'
          : 'neutral';
      events.push({
        id: `psy-${String(s._id)}`,
        at: (s.occurredAt ?? (s as { createdAt?: Date }).createdAt ?? new Date()).toISOString(),
        domain: 'PSYCHOLOGY',
        title: `Sesión ${s.sessionType ?? 'psicológica'}`,
        summary: String(s.clinicalNotes ?? s.clinicalGoal ?? 'Sesión registrada').slice(0, 280),
        sentiment: sentiment as TimelineEvent['sentiment'],
        aiDetected: (s.tags ?? []).some((t) => String(t).toLowerCase().includes('ai')),
      });
    }

    const evals = await this.evaluations
      .find({ patientId, organizationId: orgId })
      .sort({ evaluatedAt: -1 })
      .limit(30)
      .lean()
      .exec();

    for (const e of evals) {
      events.push({
        id: `eval-${String(e._id)}`,
        at: (e.evaluatedAt ?? new Date()).toISOString(),
        domain: 'PSYCHOLOGY',
        title: `Escala ${e.scaleId ?? 'psicométrica'}`,
        summary: `Puntuación ${e.totalScore} — ${e.severity ?? e.interpretation ?? ''}`,
        sentiment: 'neutral',
      });
    }

    const appts = await this.appointments
      .find({ patient_id: patientId, organization_id: orgId })
      .sort({ start_at: -1 })
      .limit(40)
      .lean()
      .exec();

    for (const a of appts) {
      const svc = String(a.service_name_snapshot ?? a.service_category_snapshot ?? '').toLowerCase();
      const isDental = svc.match(/odonto|dental/);
      events.push({
        id: `appt-${String(a._id)}`,
        at: (a.start_at ?? new Date()).toISOString(),
        domain: isDental ? 'DENTAL' : 'APPOINTMENT',
        title: String(a.service_name_snapshot ?? 'Cita'),
        summary: `Estado: ${a.status ?? 'SCHEDULED'}`,
      });
    }

    const record = await this.clinical.findOne({ patientId, organizationId: orgId }).lean().exec();
    for (const entry of record?.entries ?? []) {
      events.push({
        id: `clin-${entry.at?.toISOString?.() ?? Date.now()}`,
        at: (entry.at ?? new Date()).toISOString(),
        domain: 'CLINICAL',
        title: String(entry.type ?? 'Nota clínica'),
        summary: String(entry.note ?? '').slice(0, 280),
      });
    }

    const j48rows = await this.j48
      .find({ patientId, organizationId: orgId })
      .sort({ scoredAt: -1 })
      .limit(20)
      .lean()
      .exec();

    for (const j of j48rows) {
      events.push({
        id: `j48-${String(j._id)}`,
        at: (j.scoredAt ?? new Date()).toISOString(),
        domain: 'AI',
        title: 'Predicción J48',
        summary: `Clase ${j.classLabel}`,
        riskMarker: String(j.classLabel),
        aiDetected: true,
      });
    }

    const aiRows = await this.aiPredictions
      .find({ patientId, organizationId: orgId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .exec();

    for (const p of aiRows) {
      events.push({
        id: `ens-${String(p._id)}`,
        at: ((p as { createdAt?: Date }).createdAt ?? new Date()).toISOString(),
        domain: 'AI',
        title: 'Ensemble IA médica',
        summary: `Riesgo ${p.riskLevel} — score ${p.dynamicPsychologicalScore}`,
        riskMarker: p.riskLevel,
        aiDetected: true,
        sentiment: p.riskLevel === 'LOW' ? 'positive' : p.riskLevel === 'CRITICAL' ? 'negative' : 'neutral',
      });
    }

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return { events, analysis: this.detectTrend(events) };
  }
}
