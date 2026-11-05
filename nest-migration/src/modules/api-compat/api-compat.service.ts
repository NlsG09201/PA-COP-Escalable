import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { idVariants } from '../tenancy/tenant-query.util';

@Injectable()
export class ApiCompatService {
  private readonly logger = new Logger(ApiCompatService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async portalDashboard(patientId: string): Promise<Record<string, unknown>> {
    try {
      const patient = await this.connection.collection('patients').findOne({
        $or: [
          { patientId },
          { patientId: { $in: idVariants(patientId) as string[] } },
        ],
      });
      const name = patient
        ? `${patient.firstName ?? patient.first_name ?? ''} ${patient.lastName ?? patient.last_name ?? ''}`.trim()
        : 'Paciente';
      const appts = await this.connection
        .collection('appointments')
        .find({ patientId: { $in: idVariants(patientId) } })
        .sort({ startAt: 1, scheduledAt: 1 })
        .limit(5)
        .toArray();
      const next = appts.find((a) => new Date(a.startAt ?? a.scheduledAt ?? 0) >= new Date());
      return {
        patientName: name || 'Paciente',
        nextAppointment: next
          ? {
              id: String(next._id),
              date: new Date(next.startAt ?? next.scheduledAt ?? Date.now()).toISOString().slice(0, 10),
              time: new Date(next.startAt ?? next.scheduledAt ?? Date.now()).toISOString().slice(11, 16),
              type: String(next.type ?? next.serviceType ?? 'Consulta'),
              professionalName: String(next.professionalName ?? 'Profesional COP'),
              status: String(next.status ?? 'SCHEDULED'),
            }
          : undefined,
        activeTreatments: [],
        therapyProgress: { totalSessions: 0, completedSessions: 0, avgScore: 0, streakDays: 0 },
        recentTimeline: appts.slice(0, 3).map((a) => ({
          date: new Date(a.startAt ?? a.scheduledAt ?? Date.now()).toISOString(),
          type: 'APPOINTMENT',
          title: String(a.type ?? 'Cita'),
          description: String(a.notes ?? a.status ?? ''),
        })),
      };
    } catch (err) {
      this.logger.warn(`portalDashboard: ${(err as Error).message}`);
      return {
        patientName: 'Paciente',
        activeTreatments: [],
        therapyProgress: { totalSessions: 0, completedSessions: 0, avgScore: 0, streakDays: 0 },
        recentTimeline: [],
      };
    }
  }

  async latestJ48ForPatient(patientId: string): Promise<Record<string, unknown> | null> {
    try {
      return (
        (await this.connection
          .collection('j48_predictions')
          .find({ patientId: { $in: idVariants(patientId) } })
          .sort({ createdAt: -1, created_at: -1 })
          .limit(1)
          .next()) ?? null
      );
    } catch {
      return null;
    }
  }
}
