import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantContext } from '../tenancy/tenancy.interceptor';
import { PsychologySession } from './schemas/psychology-session.schema';
import { PsychologicalEvaluation } from './schemas/psychological-evaluation.schema';
import { CreatePsychologySessionDto } from './dto/create-psychology-session.dto';
import { CreatePsychologicalEvaluationDto } from './dto/create-psychological-evaluation.dto';

const SCALE_TEMPLATES = [
  {
    id: 'GAD7',
    name: 'Escala de Ansiedad Generalizada (GAD-7)',
    questions: 7,
    maxScore: 21,
    thresholds: [
      { max: 4, severity: 'Mínima' },
      { max: 9, severity: 'Leve' },
      { max: 14, severity: 'Moderada' },
      { max: 21, severity: 'Severa' },
    ],
  },
  {
    id: 'PHQ9',
    name: 'Cuestionario de Salud del Paciente (PHQ-9)',
    questions: 9,
    maxScore: 27,
    thresholds: [
      { max: 4, severity: 'Mínima' },
      { max: 9, severity: 'Leve' },
      { max: 14, severity: 'Moderada' },
      { max: 19, severity: 'Moderadamente severa' },
      { max: 27, severity: 'Severa' },
    ],
  },
  {
    id: 'PSS10',
    name: 'Escala de Estrés Percibido (PSS-10)',
    questions: 10,
    maxScore: 40,
    thresholds: [
      { max: 13, severity: 'Bajo' },
      { max: 26, severity: 'Moderado' },
      { max: 40, severity: 'Alto' },
    ],
  },
];

const DSM_CATEGORIES = [
  { code: 'F32', label: 'Episodio depresivo' },
  { code: 'F41', label: 'Otros trastornos de ansiedad' },
  { code: 'F43', label: 'Reacción al estrés grave y trastornos de adaptación' },
  { code: 'F50', label: 'Trastornos de la conducta alimentaria' },
  { code: 'F90', label: 'Trastornos hipercinéticos' },
];

@Injectable()
export class PsychologyService {
  constructor(
    @InjectModel(PsychologySession.name) private readonly sessions: Model<PsychologySession>,
    @InjectModel(PsychologicalEvaluation.name) private readonly evaluations: Model<PsychologicalEvaluation>,
  ) {}

  listScaleTemplates() {
    return SCALE_TEMPLATES;
  }

  listDsmCategories() {
    return DSM_CATEGORIES;
  }

  async listSessions(patientId: string, tenant: TenantContext, limit = 50) {
    return this.sessions
      .find({ patientId, organizationId: tenant.organizationId })
      .sort({ occurredAt: -1, createdAt: -1 })
      .limit(Math.min(100, limit))
      .lean()
      .exec();
  }

  async createSession(
    patientId: string,
    dto: CreatePsychologySessionDto,
    tenant: TenantContext,
    userId: string,
  ) {
    const doc = await this.sessions.create({
      patientId,
      organizationId: tenant.organizationId,
      siteId: tenant.siteId,
      professionalUserId: userId,
      sessionType: dto.sessionType ?? 'INDIVIDUAL',
      clinicalGoal: dto.clinicalGoal,
      clinicalNotes: dto.clinicalNotes,
      emotionalState: dto.emotionalState,
      scaleScores: dto.scaleScores,
      dsmCategory: dto.dsmCategory,
      dsmCode: dto.dsmCode,
      status: dto.status ?? 'COMPLETED',
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      durationMinutes: dto.durationMinutes ?? 50,
      tags: dto.tags ?? [],
    });
    return doc.toObject();
  }

  async evolutionSeries(patientId: string, tenant: TenantContext) {
    const sessions = await this.sessions
      .find({ patientId, organizationId: tenant.organizationId, status: 'COMPLETED' })
      .sort({ occurredAt: 1 })
      .select('occurredAt emotionalState scaleScores dsmCode')
      .lean()
      .exec();

    const evaluations = await this.evaluations
      .find({ patientId, organizationId: tenant.organizationId })
      .sort({ evaluatedAt: 1 })
      .select('scaleId totalScore severity evaluatedAt')
      .lean()
      .exec();

    return {
      sessions: sessions.map((s) => ({
        date: s.occurredAt,
        wellbeing: Number((s.emotionalState as any)?.wellbeing ?? 0),
        anxiety: Number((s.emotionalState as any)?.anxiety ?? 0),
        depression: Number((s.emotionalState as any)?.depression ?? 0),
        stress: Number((s.scaleScores as any)?.stress ?? 0),
        dsmCode: s.dsmCode,
      })),
      evaluations: evaluations.map((e) => ({
        date: e.evaluatedAt,
        scaleId: e.scaleId,
        totalScore: e.totalScore,
        severity: e.severity,
      })),
    };
  }

  async listEvaluations(patientId: string, tenant: TenantContext) {
    return this.evaluations
      .find({ patientId, organizationId: tenant.organizationId })
      .sort({ evaluatedAt: -1 })
      .lean()
      .exec();
  }

  async submitEvaluation(
    patientId: string,
    dto: CreatePsychologicalEvaluationDto,
    tenant: TenantContext,
    userId: string,
  ) {
    const template = SCALE_TEMPLATES.find((t) => t.id === dto.scaleId);
    if (!template) throw new NotFoundException('Escala no encontrada');

    const totalScore = Object.values(dto.responses).reduce((a, b) => a + Number(b || 0), 0);
    const severity =
      template.thresholds.find((t) => totalScore <= t.max)?.severity ?? 'No clasificado';

    const doc = await this.evaluations.create({
      patientId,
      organizationId: tenant.organizationId,
      siteId: tenant.siteId,
      scaleId: dto.scaleId,
      scaleName: template.name,
      responses: dto.responses,
      totalScore,
      severity,
      interpretation: dto.interpretation ?? `Puntuación ${totalScore}/${template.maxScore} — ${severity}`,
      evaluatedAt: new Date(),
      evaluatedByUserId: userId,
    });
    return doc.toObject();
  }

  async assertPatientAccess(patientId: string, tenant: TenantContext) {
    if (!tenant.organizationId) throw new ForbiddenException('Contexto de organización requerido');
    return patientId;
  }
}
