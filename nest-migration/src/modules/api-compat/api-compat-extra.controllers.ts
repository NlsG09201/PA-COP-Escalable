import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { ApiCompatService } from './api-compat.service';

const THERAPY_MODULES = [
  {
    id: 'mod-cbt-basic',
    name: 'Reestructuración cognitiva',
    category: 'COGNITIVE',
    description: 'Identificación de pensamientos automáticos y reencuadre.',
    durationMinutes: 45,
    difficulty: 'MEDIUM',
  },
  {
    id: 'mod-relaxation',
    name: 'Relajación y respiración',
    category: 'MINDFULNESS',
    description: 'Técnicas de regulación fisiológica del estrés.',
    durationMinutes: 30,
    difficulty: 'LOW',
  },
  {
    id: 'mod-adherence',
    name: 'Adherencia al tratamiento',
    category: 'BEHAVIORAL',
    description: 'Plan de seguimiento y barreras de adherencia.',
    durationMinutes: 40,
    difficulty: 'MEDIUM',
  },
];

function okId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

@ApiTags('compat')
@ApiBearerAuth()
@Controller('api/portal')
@UseGuards(JwtAuthGuard)
export class PortalCompatController {
  constructor(private readonly compat: ApiCompatService) {}

  @Post('patients/:patientId/token')
  token(@Param('patientId') patientId: string) {
    const expires = new Date(Date.now() + 7 * 86400000).toISOString();
    return { token: okId('portal'), patientId, expiresAt: expires };
  }

  @Post('authenticate')
  authenticate(@Body() body: { token?: string }) {
    return {
      token: body?.token ?? okId('portal'),
      patientId: 'unknown',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
  }

  @Get('dashboard')
  dashboard(@Req() req: { user?: { patientId?: string }; query?: { patientId?: string } }) {
    const patientId = req.user?.patientId ?? (req as { query?: { patientId?: string } }).query?.patientId ?? '';
    return patientId ? this.compat.portalDashboard(patientId) : this.compat.portalDashboard('unknown');
  }

  @Get('timeline')
  timeline() {
    return [];
  }

  @Get('treatments')
  treatments() {
    return [];
  }

  @Get('appointments')
  appointments() {
    return [];
  }

  @Get('therapy-progress')
  therapyProgress() {
    return { totalSessions: 0, completedSessions: 0, avgScore: 0, streakDays: 0 };
  }
}

@Controller('api/decisions')
@UseGuards(JwtAuthGuard)
export class DecisionsCompatController {
  constructor(private readonly compat: ApiCompatService) {}

  @Post('patients/:patientId/recommend')
  async recommend(@Param('patientId') patientId: string, @Body() body: Record<string, unknown>) {
    const j48 = await this.compat.latestJ48ForPatient(patientId);
    const risk = String(j48?.riskLevel ?? j48?.risk_level ?? 'MEDIUM');
    return {
      id: okId('dec'),
      patientId,
      specialty: String(body?.specialty ?? 'GENERAL'),
      recommendation: j48
        ? `Priorizar seguimiento por riesgo ${risk} (J48).`
        : 'Complete evaluación J48 o sesión psicológica para recomendación personalizada.',
      confidence: j48 ? 0.78 : 0.45,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
  }

  @Post(':decisionId/accept')
  accept(@Param('decisionId') decisionId: string) {
    return { id: decisionId, status: 'ACCEPTED', updatedAt: new Date().toISOString() };
  }

  @Get('patients/:patientId')
  list(@Param('patientId') patientId: string) {
    return [];
  }

  @Get('stats')
  stats() {
    return { pending: 0, accepted: 0, rejected: 0 };
  }
}

@Controller('api/personalization')
@UseGuards(JwtAuthGuard)
export class PersonalizationCompatController {
  constructor(private readonly compat: ApiCompatService) {}

  @Get('patients/:patientId/profile')
  async profile(@Param('patientId') patientId: string) {
    const j48 = await this.compat.latestJ48ForPatient(patientId);
    return {
      patientId,
      engagementScore: j48 ? 0.65 : 0.5,
      preferredChannel: 'IN_PERSON',
      riskSegment: String(j48?.riskLevel ?? 'UNKNOWN'),
      lastUpdated: new Date().toISOString(),
    };
  }

  @Post('patients/:patientId/calculate')
  calculate(@Param('patientId') patientId: string) {
    return this.profile(patientId);
  }

  @Get('patients/:patientId/recommendations')
  async recommendations(@Param('patientId') patientId: string) {
    const j48 = await this.compat.latestJ48ForPatient(patientId);
    if (!j48) return [];
    const recs = Array.isArray(j48.recommendations) ? j48.recommendations : [];
    return recs.slice(0, 5).map((text: unknown, i: number) => ({
      id: `rec-${i}`,
      title: String(text).slice(0, 80),
      description: String(text),
      priority: i === 0 ? 'HIGH' : 'MEDIUM',
    }));
  }
}
