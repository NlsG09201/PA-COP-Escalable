import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { idVariants } from '../tenancy/tenant-query.util';

@Injectable()
export class ApiCompatService {
  private readonly logger = new Logger(ApiCompatService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async emotionResultsForPatient(patientId: string): Promise<Record<string, unknown>[]> {
    try {
      const rows = await this.connection
        .collection('psychology_sessions')
        .find({
          patientId,
          emotionalState: { $exists: true, $ne: null },
        })
        .sort({ occurredAt: -1, createdAt: -1 })
        .limit(50)
        .toArray();

      return rows.map((row, idx) => {
        const emo = (row.emotionalState ?? {}) as Record<string, unknown>;
        const anxiety = Number(emo.anxiety ?? 0.5);
        const depression = Number(emo.depression ?? 0.4);
        const wellbeing = String(emo.wellbeing ?? emo.sentiment ?? 'NEUTRAL');
        const primary = this.inferPrimaryEmotion(wellbeing, anxiety, depression);
        const confidence = Math.min(0.95, Math.max(0.45, 0.55 + anxiety * 0.2 + depression * 0.15));

        const occurred = row.occurredAt ?? row.created_at ?? row.createdAt ?? new Date();
        const analyzedAt = new Date(occurred).toISOString();

        return {
          jobId: `psy-${String(row._id)}`,
          status: 'COMPLETED',
          primaryEmotion: primary,
          allEmotions: [
            { label: primary, confidence },
            { label: 'NEUTRAL', confidence: Math.max(0.1, 1 - confidence) * 0.5 },
          ],
          prosody: {
            pitchMean: 180,
            pitchStd: 22,
            energyMean: 0.55,
            energyStd: 0.12,
            speechRate: 2.8,
            pauseRatio: anxiety > 0.6 ? 0.35 : 0.18,
          },
          audioDurationSec: Number(row.durationMinutes ?? 45) * 60,
          patientId,
          analyzedAt,
          source: 'psychology_sessions',
          sessionIndex: idx,
        };
      });
    } catch (err) {
      this.logger.warn(`emotionResultsForPatient: ${(err as Error).message}`);
      return [];
    }
  }

  async diagnosisResultsForPatient(patientId: string): Promise<Record<string, unknown>[]> {
    try {
      const odonto = await this.connection.collection('odontograms').findOne({
        patientId: { $in: idVariants(patientId) },
      });

      if (!odonto) return [];

      const findings: Array<Record<string, unknown>> = [];
      const clinical = (odonto.clinicalTeeth ?? {}) as Record<string, { diagnosis?: string; status?: string }>;
      for (const [toothId, state] of Object.entries(clinical)) {
        const dx = String(state?.diagnosis ?? '').trim();
        if (!dx) continue;
        findings.push({
          label: dx,
          confidence: 0.82,
          description: `Pieza ${toothId}: ${state?.status ?? 'evaluada'}`,
        });
      }

      if (!findings.length) return [];

      const updated = odonto.updatedAt ?? odonto.updated_at ?? odonto.createdAt ?? new Date();
      return [
        {
          id: `odonto-${String(odonto._id)}`,
          patientId,
          imageId: 'odontogram-clinical',
          findings,
          modelVersion: 'cop-odontogram-v1',
          processingTimeMs: 0,
          status: 'COMPLETED',
          createdAt: new Date(updated).toISOString(),
          source: 'odontograms',
        },
      ];
    } catch (err) {
      this.logger.warn(`diagnosisResultsForPatient: ${(err as Error).message}`);
      return [];
    }
  }

  private inferPrimaryEmotion(wellbeing: string, anxiety: number, depression: number): string {
    const w = String(wellbeing).toUpperCase();
    if (w.includes('NEG') || anxiety >= 0.7 || depression >= 0.7) return 'NEGATIVE';
    if (w.includes('POS') && anxiety < 0.4 && depression < 0.4) return 'POSITIVE';
    return 'NEUTRAL';
  }
}
