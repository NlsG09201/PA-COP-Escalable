import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Patient } from '../patients/patient.schema';
import { Appointment, AppointmentStatus } from '../appointments/schemas/appointment.schema';
import { PsychologicalSnapshot } from './schemas/psychological-snapshot.schema';
import { J48Prediction } from './schemas/j48-prediction.schema';
import { SUPER_ADMIN_ROLE } from '../iam/roles.constants';
import { JwtUserLike } from './j48-user.types';

type J48Features = {
  gender?: 'M' | 'F' | 'O';
  age_group?: 'YOUNG_ADULT' | 'ADULT' | 'SENIOR';
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  wellbeing?: 'HIGH' | 'MEDIUM' | 'LOW';
  anxiety?: number;
  depression?: number;
  attendance?: 'REGULAR' | 'IRREGULAR';
  days_since_last?: number;
};

@Injectable()
export class J48ScoringService {
  constructor(
    @InjectModel(Patient.name) private readonly patients: Model<Patient>,
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(PsychologicalSnapshot.name) private readonly snapshots: Model<PsychologicalSnapshot>,
    @InjectModel(J48Prediction.name) private readonly predictions: Model<J48Prediction>,
  ) {}

  private isSuperAdmin(user: JwtUserLike): boolean {
    return Array.isArray(user.roles) && user.roles.includes(SUPER_ADMIN_ROLE);
  }

  /** Si no es SUPER_ADMIN, devuelve organization_id del token. SUPER puede fijar otra organización explícita. */
  resolveOrgScope(user: JwtUserLike, organizationIdOverride?: string): string | undefined {
    if (this.isSuperAdmin(user)) {
      return organizationIdOverride ? String(organizationIdOverride) : undefined;
    }
    return user.organization_id ? String(user.organization_id) : undefined;
  }

  async scorePatientForUser(patientId: string, user: JwtUserLike, organizationIdOverride?: string): Promise<J48Prediction | null> {
    const orgScope = this.resolveOrgScope(user, organizationIdOverride);
    if (!this.isSuperAdmin(user) && !orgScope) {
      throw new ForbiddenException('Falta contexto de organización en el token');
    }

    const filter: Record<string, unknown> = { _id: patientId };
    if (orgScope) filter.organization_id = orgScope;

    const patient = await this.patients.findOne(filter).lean().exec();
    if (!patient) throw new NotFoundException('Paciente no encontrado');

    return this.scorePatientInternal(
      patientId,
      String((patient as { organization_id: string }).organization_id),
      (patient as { site_id?: string }).site_id ? String((patient as { site_id?: string }).site_id) : undefined,
    );
  }

  /** Procesamiento por lotes: hasta J48_SCORE_BATCH_MAX registros con concurrencia J48_SCORE_CONCURRENCY (soporta ~15k+). */
  async scoreAllForUser(
    user: JwtUserLike,
    opts?: { organizationId?: string },
  ): Promise<{ scored: number; examined: number; organizationScope?: string }> {
    const orgScope = this.resolveOrgScope(user, opts?.organizationId);
    if (!orgScope) {
      throw new ForbiddenException(
        this.isSuperAdmin(user)
          ? 'SUPER_ADMIN debe enviar organizationId en el cuerpo para puntuación masiva'
          : 'Falta contexto de organización',
      );
    }
    if (!this.isSuperAdmin(user) && String(orgScope) !== String(user.organization_id)) {
      throw new ForbiddenException('No puedes puntuar otra organización');
    }

    const maxTotal = Math.min(50_000, Math.max(1, Number(process.env.J48_SCORE_BATCH_MAX ?? 15_000)));
    const concurrency = Math.min(32, Math.max(1, Number(process.env.J48_SCORE_CONCURRENCY ?? 12)));

    const filter: Record<string, unknown> = { status: { $ne: 'INACTIVE' } };
    if (orgScope) filter.organization_id = orgScope;

    const slice = await this.patients
      .find(filter)
      .select('_id organization_id site_id')
      .limit(maxTotal)
      .lean()
      .exec();

    let scored = 0;
    for (let i = 0; i < slice.length; i += concurrency) {
      const chunk = slice.slice(i, i + concurrency);
      const results = await Promise.all(
        chunk.map((p) =>
          this.scorePatientInternal(String(p._id), String(p.organization_id), p.site_id ? String(p.site_id) : undefined),
        ),
      );
      scored += results.filter(Boolean).length;
    }

    return { scored, examined: slice.length, organizationScope: orgScope };
  }

  async classDistributionForUser(user: JwtUserLike, organizationIdOverride?: string) {
    const orgScope = this.resolveOrgScope(user, organizationIdOverride);
    if (!this.isSuperAdmin(user) && !orgScope) {
      throw new ForbiddenException('Falta contexto de organización');
    }
    const match: Record<string, unknown> = {};
    if (orgScope) match.organizationId = orgScope;

    return this.predictions
      .aggregate<{ label: string; count: number }>([
        { $match: match },
        { $group: { _id: '$classLabel', count: { $sum: 1 } } },
        { $project: { _id: 0, label: { $ifNull: ['$_id', ''] }, count: 1 } },
        { $sort: { count: -1 } },
      ])
      .exec();
  }

  async monthlyTrendForUser(user: JwtUserLike, fromIso: string, toIso: string, organizationIdOverride?: string) {
    const orgScope = this.resolveOrgScope(user, organizationIdOverride);
    if (!this.isSuperAdmin(user) && !orgScope) {
      throw new ForbiddenException('Falta contexto de organización');
    }
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return { series: [] as Array<{ bucket: string; total: number }> };
    }

    const match: Record<string, unknown> = { scoredAt: { $gte: from, $lte: to } };
    if (orgScope) match.organizationId = orgScope;

    const raw = await this.predictions
      .aggregate<{ bucket: string; total: number }>([
        { $match: match },
        {
          $group: {
            _id: { $dateTrunc: { date: '$scoredAt', unit: 'month', timezone: 'UTC' } },
            total: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            bucket: { $dateToString: { date: '$_id', format: '%Y-%m', timezone: 'UTC' } },
            total: 1,
          },
        },
        { $sort: { bucket: 1 } },
      ])
      .exec();

    return { series: raw };
  }

  async latestPredictionForPatient(patientId: string, user: JwtUserLike, organizationIdOverride?: string) {
    const orgScope = this.resolveOrgScope(user, organizationIdOverride);
    if (!this.isSuperAdmin(user) && !orgScope) throw new ForbiddenException('Falta contexto de organización');

    const match: Record<string, unknown> = { patientId };
    if (orgScope) match.organizationId = orgScope;

    const doc = await this.predictions.findOne(match).sort({ scoredAt: -1 }).lean().exec();
    if (!doc) return null;
    return {
      id: String(doc._id),
      patientId: doc.patientId,
      organizationId: doc.organizationId,
      siteId: doc.siteId ?? null,
      classLabel: doc.classLabel,
      probabilities: doc.probabilities ?? {},
      features: doc.features,
      scoredAt: doc.scoredAt,
    };
  }

  async predictionHistoryForPatient(
    patientId: string,
    user: JwtUserLike,
    opts?: { limit?: number; organizationId?: string },
  ) {
    const orgScope = this.resolveOrgScope(user, opts?.organizationId);
    if (!this.isSuperAdmin(user) && !orgScope) throw new ForbiddenException('Falta contexto de organización');

    const limit = Math.min(100, Math.max(1, Number(opts?.limit ?? 24)));
    const match: Record<string, unknown> = { patientId };
    if (orgScope) match.organizationId = orgScope;

    const rows = await this.predictions
      .find(match)
      .sort({ scoredAt: -1 })
      .limit(limit)
      .select('classLabel probabilities scoredAt features')
      .lean()
      .exec();

    return rows.map((r) => ({
      id: String(r._id),
      classLabel: r.classLabel,
      probabilities: r.probabilities ?? {},
      features: r.features,
      scoredAt: r.scoredAt,
      riskScore: this.classLabelToRiskScore(r.classLabel),
    }));
  }

  private classLabelToRiskScore(label: string): number {
    const normalized = String(label ?? '').trim().toUpperCase();
    if (normalized.includes('CRIT') || normalized.includes('ALTO') || normalized.includes('HIGH')) return 85;
    if (normalized.includes('MED') || normalized.includes('MODER')) return 55;
    if (normalized.includes('BAJO') || normalized.includes('LOW')) return 20;
    return 40;
  }

  /** Número de predicciones almacenadas (agregación, sin volcar todos los registros al cliente). */
  async predictionsCountForUser(user: JwtUserLike, organizationIdOverride?: string) {
    const orgScope = this.resolveOrgScope(user, organizationIdOverride);
    if (!this.isSuperAdmin(user) && !orgScope) throw new ForbiddenException('Falta contexto de organización');
    const match: Record<string, unknown> = {};
    if (orgScope) match.organizationId = orgScope;
    const total = await this.predictions.countDocuments(match).exec();
    return { total, organizationScope: orgScope ?? null };
  }

  private async scorePatientInternal(
    patientId: string,
    organizationId: string,
    siteId?: string,
  ): Promise<J48Prediction | null> {
    const pRecord = await this.patients.findOne({ _id: patientId, organization_id: organizationId }).lean().exec();
    if (!pRecord) return null;

    const latestSnapshot = await this.snapshots
      .findOne({
        patientId,
        ...(organizationId ? { organizationId } : {}),
        ...(siteId ? { siteId } : {}),
      })
      .sort({ occurredAt: -1 })
      .lean()
      .exec();

    const lastAppointment = await this.appointments
      .findOne({
        patient_id: patientId,
        ...(organizationId ? { organization_id: organizationId } : {}),
        ...(siteId ? { site_id: siteId } : {}),
      })
      .sort({ end_at: -1 })
      .lean()
      .exec();

    const now = new Date();
    const daysSinceLast = lastAppointment?.end_at
      ? Math.max(0, Math.floor((now.getTime() - new Date(lastAppointment.end_at).getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    const completedLast30 = await this.appointments.countDocuments({
      patient_id: patientId,
      ...(organizationId ? { organization_id: organizationId } : {}),
      ...(siteId ? { site_id: siteId } : {}),
      status: AppointmentStatus.COMPLETED,
      end_at: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
    });

    const attendance: J48Features['attendance'] = completedLast30 >= 1 ? 'REGULAR' : 'IRREGULAR';

    const sentiment = this.mapSentiment(latestSnapshot?.predominantSentiment);
    const wellbeing = this.bucketWellbeing(Number((latestSnapshot?.metrics as any)?.wellbeing));
    const anxiety = this.safe01((latestSnapshot?.metrics as any)?.anxiety);
    const depression = this.safe01((latestSnapshot?.metrics as any)?.depression);

    const gender = this.mapGender((pRecord as any)?.gender);
    const ageGroup = this.deriveAgeGroup((pRecord as any)?.birth_date);

    const features: J48Features = {
      gender: gender ?? undefined,
      age_group: ageGroup ?? undefined,
      sentiment: sentiment ?? undefined,
      wellbeing: wellbeing ?? undefined,
      anxiety: anxiety ?? undefined,
      depression: depression ?? undefined,
      attendance,
      days_since_last: typeof daysSinceLast === 'number' ? daysSinceLast : undefined,
    };

    const prediction = await this.callJ48Predict(features);
    const doc = new this.predictions({
      organizationId,
      siteId: siteId ?? null,
      patientId,
      scoredAt: now,
      features,
      classLabel: String(prediction.classLabel ?? ''),
      probabilities: prediction.probabilities ?? undefined,
    });
    await doc.save();
    return this.predictions.findById(doc._id).exec();
  }

  private async callJ48Predict(features: Record<string, unknown>): Promise<any> {
    const base = (process.env.J48_URL ?? 'http://j48-python:8080').replace(/\/predict\/?$/, '');
    const res = await fetch(`${base}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`j48-service predict failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  private mapSentiment(raw: unknown): J48Features['sentiment'] | null {
    const s = String(raw ?? '').trim().toLowerCase();
    if (!s) return null;
    if (s.startsWith('pos')) return 'POSITIVE';
    if (s.startsWith('neg')) return 'NEGATIVE';
    return 'NEUTRAL';
  }

  private bucketWellbeing(raw: number): J48Features['wellbeing'] | null {
    if (!Number.isFinite(raw)) return null;
    if (raw >= 0.66) return 'HIGH';
    if (raw >= 0.33) return 'MEDIUM';
    return 'LOW';
  }

  private safe01(raw: unknown): number | null {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(1, n));
  }

  private mapGender(raw: unknown): J48Features['gender'] | null {
    const s = String(raw ?? '').trim().toUpperCase();
    if (s === 'M' || s === 'F' || s === 'O') return s as any;
    return null;
  }

  private deriveAgeGroup(birthDateRaw: unknown): J48Features['age_group'] | null {
    if (!birthDateRaw) return null;
    const d = new Date(String(birthDateRaw));
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let years = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;
    if (!Number.isFinite(years) || years < 0) return null;
    if (years < 35) return 'YOUNG_ADULT';
    if (years < 60) return 'ADULT';
    return 'SENIOR';
  }
}
