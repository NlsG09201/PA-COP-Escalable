import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { ApiCompatService } from './api-compat.service';

/**
 * Compatibilidad Angular: datos desde Mongo cuando los microservicios AI no están en Render.
 */
@ApiTags('compat')
@ApiBearerAuth()
@Controller('api/diagnosis')
@UseGuards(JwtAuthGuard)
export class DiagnosisCompatController {
  constructor(private readonly compat: ApiCompatService) {}

  @Get('patients/:patientId/results')
  results(@Param('patientId') patientId: string) {
    return this.compat.diagnosisResultsForPatient(patientId);
  }

  @Post('patients/:patientId/analyze')
  analyze(@Param('patientId') patientId: string) {
    return this.compat.stubDiagnosisAnalyze(patientId);
  }

  @Get('results/:resultId')
  resultById(@Param('resultId') resultId: string) {
    return {
      id: resultId,
      status: 'COMPLETED',
      findings: [],
      createdAt: new Date().toISOString(),
    };
  }
}

@Controller('api/budget')
@UseGuards(JwtAuthGuard)
export class BudgetCompatController {
  @Get('patients/:patientId')
  list() {
    return [];
  }

  @Post('patients/:patientId/generate')
  generate(@Param('patientId') patientId: string) {
    return this.budgetDraft(patientId);
  }

  @Post('patients/:patientId/generate-from-plan')
  generateFromPlan(@Param('patientId') patientId: string) {
    return this.budgetDraft(patientId);
  }

  private budgetDraft(patientId: string) {
    return {
      id: randomUUID(),
      patientId,
      status: 'DRAFT',
      totalAmount: 0,
      currency: 'COP',
      items: [],
      createdAt: new Date().toISOString(),
    };
  }

  @Get(':budgetId')
  one(@Param('budgetId') budgetId: string) {
    return { id: budgetId, status: 'DRAFT', totalAmount: 0, items: [] };
  }

  @Put(':budgetId/approve')
  approve(@Param('budgetId') budgetId: string) {
    return { id: budgetId, status: 'APPROVED' };
  }

  @Post(':budgetId/simulate-payment')
  simulate(@Param('budgetId') budgetId: string) {
    return { budgetId, installments: [], totalWithInterest: 0 };
  }
}

@Controller('api/followup')
@UseGuards(JwtAuthGuard)
export class FollowupCompatController {
  @Get('patients/:patientId/surveys')
  surveys() {
    return [];
  }

  @Get('patients/:patientId/schedules')
  schedules() {
    return [];
  }

  @Post('patients/:patientId/generate')
  generate(@Param('patientId') patientId: string) {
    return {
      id: randomUUID(),
      patientId,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
  }

  @Post('surveys/:surveyId/complete')
  complete(@Param('surveyId') surveyId: string) {
    return { id: surveyId, status: 'COMPLETED', completedAt: new Date().toISOString() };
  }
}

@Controller('api/psychology')
@UseGuards(JwtAuthGuard)
export class PsychologyCompatController {
  @Get('patients/:patientId/evolution')
  evolution() {
    return [];
  }
}

@Controller('api/emotion')
@UseGuards(JwtAuthGuard)
export class EmotionCompatController {
  constructor(private readonly compat: ApiCompatService) {}

  @Get('patients/:patientId/results')
  results(@Param('patientId') patientId: string) {
    return this.compat.emotionResultsForPatient(patientId);
  }

  @Post('patients/:patientId/analyze')
  analyze(@Param('patientId') patientId: string) {
    return this.compat.stubEmotionAnalyze(patientId);
  }

  @Get('results/:jobId')
  resultByJob(@Param('jobId') jobId: string) {
    return { jobId, status: 'COMPLETED', primaryEmotion: 'NEUTRAL' };
  }
}

const THERAPY_MODULES = [
  {
    id: 'mod-cbt-basic',
    code: 'CBT-BASIC',
    name: 'Reestructuración cognitiva',
    category: 'COGNITIVE',
    description: 'Identificación de pensamientos automáticos.',
    difficulty: 'MEDIUM',
    durationMin: 45,
    contentJson: '{}',
    active: true,
  },
  {
    id: 'mod-relaxation',
    code: 'RELAX-01',
    name: 'Relajación guiada',
    category: 'MINDFULNESS',
    description: 'Regulación del estrés.',
    difficulty: 'LOW',
    durationMin: 30,
    contentJson: '{}',
    active: true,
  },
];

@Controller('api/therapy')
@UseGuards(JwtAuthGuard)
export class TherapyCompatController {
  @Get('modules')
  modules() {
    return THERAPY_MODULES;
  }

  @Get('patients/:patientId/progress')
  progress() {
    return {
      totalSessions: 0,
      avgScore: 0,
      sessionsByCategory: {} as Record<string, number>,
      streakDays: 0,
    };
  }

  @Get('patients/:patientId/sessions')
  sessions() {
    return [];
  }

  @Post('patients/:patientId/sessions/start')
  startSession(@Param('patientId') patientId: string, @Body() body: { moduleId?: string }) {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      patientId,
      moduleId: body?.moduleId ?? THERAPY_MODULES[0].id,
      status: 'IN_PROGRESS',
      startedAt: now,
    };
  }

  @Post('sessions/:sessionId/complete')
  completeSession(@Param('sessionId') sessionId: string) {
    return { id: sessionId, status: 'COMPLETED', completedAt: new Date().toISOString() };
  }

  @Post('sessions/:sessionId/abandon')
  abandonSession(@Param('sessionId') sessionId: string) {
    return { id: sessionId, status: 'ABANDONED' };
  }

  @Get('patients/:patientId/recommend')
  recommend() {
    return THERAPY_MODULES[0];
  }
}

@Controller('api/relapse')
@UseGuards(JwtAuthGuard)
export class RelapseCompatController {
  @Get('patients/:patientId/trend')
  trend() {
    return [];
  }

  @Get('patients/:patientId/risk')
  risk(@Param('patientId') patientId: string) {
    return {
      id: 'compat-stub',
      patientId,
      riskScore: 0,
      riskLevel: 'UNKNOWN',
      factors: [],
      actions: [],
      acknowledged: false,
      createdAt: new Date(0).toISOString(),
    };
  }
}

@Controller('api/psych-tests')
@UseGuards(JwtAuthGuard)
export class PsychTestsCompatController {
  @Get('templates')
  templates() {
    return [];
  }

  @Get('patients/:patientId/submissions')
  submissions() {
    return [];
  }
}

@Controller('api/copilot')
@UseGuards(JwtAuthGuard)
export class CopilotCompatController {
  @Get('patients/:patientId/history')
  history() {
    return [];
  }

  @Post('patients/:patientId/start')
  start(@Param('patientId') patientId: string, @Body() body: { sessionType?: string }) {
    return {
      id: randomUUID(),
      patientId,
      sessionType: body?.sessionType ?? 'CLINICAL',
      status: 'ACTIVE',
      startedAt: new Date().toISOString(),
    };
  }

  @Post('sessions/:sessionId/suggest')
  suggest(@Param('sessionId') sessionId: string) {
    return { sessionId, suggestion: 'Revise adherencia y factores de riesgo recientes del paciente.' };
  }

  @Post('sessions/:sessionId/summarize')
  summarize(@Param('sessionId') sessionId: string) {
    return { sessionId, summary: 'Sesión registrada. Sin resumen automático en este entorno.' };
  }

  @Post('sessions/:sessionId/end')
  end(@Param('sessionId') sessionId: string) {
    return { id: sessionId, status: 'ENDED', endedAt: new Date().toISOString() };
  }

  @Get('professionals/:professionalId/active')
  active() {
    return [];
  }
}

@Controller('api/experience')
@UseGuards(JwtAuthGuard)
export class ExperienceCompatController {
  @Get('patients/:patientId')
  patient() {
    return { surveys: [], avgNps: 0 };
  }

  @Get('metrics')
  metrics() {
    return { avgNps: 0, responseRate: 0 };
  }

  @Post('patients/:patientId/surveys')
  createSurvey(@Param('patientId') patientId: string) {
    return { id: randomUUID(), patientId, status: 'PENDING', createdAt: new Date().toISOString() };
  }

  @Post('surveys/:surveyId/complete')
  completeSurvey(@Param('surveyId') surveyId: string) {
    return { id: surveyId, status: 'COMPLETED', npsScore: 8 };
  }

  @Post('patients/:patientId/churn-prediction')
  churn(@Param('patientId') patientId: string) {
    return { patientId, churnRisk: 'LOW', score: 0.2, factors: [] };
  }
}
