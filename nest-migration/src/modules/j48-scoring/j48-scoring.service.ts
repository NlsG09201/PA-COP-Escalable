import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Patient } from '../patients/patient.schema';
import { Appointment, AppointmentStatus } from '../appointments/schemas/appointment.schema';
import { PsychologicalSnapshot } from './schemas/psychological-snapshot.schema';
import { J48Prediction } from './schemas/j48-prediction.schema';

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

  async scoreAllPatients(): Promise<{ scored: number }> {
    const cursor = this.patients.find({ status: { $ne: 'INACTIVE' } }).cursor();
    let scored = 0;
    for await (const p of cursor) {
      const res = await this.scorePatient(String(p._id), p.organization_id, p.site_id);
      if (res) scored++;
    }
    return { scored };
  }

  async scorePatient(patientId: string, organizationId?: string, siteId?: string): Promise<J48Prediction | null> {
    const patient = await this.patients
      .findOne({ _id: patientId, ...(organizationId ? { organization_id: organizationId } : {}), ...(siteId ? { site_id: siteId } : {}) })
      .lean()
      .exec();

    const latestSnapshot = await this.snapshots
      .findOne({ patientId, ...(organizationId ? { organizationId } : {}), ...(siteId ? { siteId } : {}) })
      .sort({ occurredAt: -1 })
      .lean()
      .exec();

    const lastAppointment = await this.appointments
      .findOne({ patient_id: patientId, ...(organizationId ? { organization_id: organizationId } : {}), ...(siteId ? { site_id: siteId } : {}) })
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

    const gender = this.mapGender((patient as any)?.gender);
    const ageGroup = this.deriveAgeGroup((patient as any)?.birth_date);

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
      organizationId: organizationId ?? null,
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
    const base = process.env.J48_URL ?? 'http://j48-service:8080';
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

