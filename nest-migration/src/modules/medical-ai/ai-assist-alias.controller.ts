import { Body, Controller, Get, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { TenancyInterceptor, TenantContext } from '../tenancy/tenancy.interceptor';
import { MedicalAiService } from './medical-ai.service';
import { MedicalAiPredictionService } from './medical-ai-prediction.service';

type AiAssistBody = {
  sourceType?: string;
  clinicalContext?: string;
};

@ApiTags('ai-assist')
@ApiBearerAuth()
@Controller('api/ai-assist')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class AiAssistAliasController {
  constructor(
    private readonly medicalAi: MedicalAiService,
    private readonly predictions: MedicalAiPredictionService,
  ) {}

  @Post('patients/:patientId/analyze-context')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  async analyzeContext(
    @Param('patientId') patientId: string,
    @Body() body: AiAssistBody,
    @Req() req: { tenant: TenantContext; user: { userId: string; roles?: string[] } },
  ) {
    const assessed = await this.medicalAi.assessPatient(patientId, req.tenant, req.user);
    return this.toSuggestionVm(patientId, body.sourceType ?? 'CLINICAL_INTERVIEW', body.clinicalContext, assessed);
  }

  @Post('patients/:patientId/psych-tests/submissions/:submissionId/analyze')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  async analyzeSubmission(
    @Param('patientId') patientId: string,
    @Param('submissionId') submissionId: string,
    @Req() req: { tenant: TenantContext; user: { userId: string; roles?: string[] } },
  ) {
    const assessed = await this.medicalAi.assessPatient(patientId, req.tenant, req.user);
    return this.toSuggestionVm(
      patientId,
      'PSYCH_TEST_SUBMISSION',
      `Evaluación psicométrica ${submissionId}`,
      assessed,
    );
  }

  @Get('patients/:patientId/suggestions/latest')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO', 'ODONTOLOGO')
  async latest(
    @Param('patientId') patientId: string,
    @Req() req: { tenant: TenantContext },
  ) {
    const latest = await this.predictions.latestForPatient(patientId, req.tenant);
    if (!latest) {
      return this.toSuggestionVm(patientId, 'INITIAL_EVALUATION', '', null);
    }
    return this.toSuggestionVm(patientId, 'INITIAL_EVALUATION', '', { prediction: latest });
  }

  @Post('suggestions/:suggestionId/approve')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  approve(@Param('suggestionId') suggestionId: string, @Body() body: { note?: string }) {
    return {
      id: suggestionId,
      status: 'APPROVED',
      reviewNote: body?.note ?? '',
      updatedAt: new Date().toISOString(),
    };
  }

  @Post('suggestions/:suggestionId/reject')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  reject(@Param('suggestionId') suggestionId: string, @Body() body: { reason?: string }) {
    return {
      id: suggestionId,
      status: 'REJECTED',
      reviewNote: body?.reason ?? '',
      updatedAt: new Date().toISOString(),
    };
  }

  private toSuggestionVm(
    patientId: string,
    sourceType: string,
    clinicalContext: string | undefined,
    assessed: Record<string, unknown> | null,
  ) {
    const pred = (assessed?.prediction ?? assessed) as Record<string, unknown> | undefined;
    const riskRaw = String(pred?.riskLevel ?? pred?.risk_level ?? 'unknown').toLowerCase();
    const riskLevel: string =
      riskRaw.includes('high') || riskRaw.includes('critical')
        ? 'high'
        : riskRaw.includes('medium') || riskRaw.includes('warn')
          ? 'medium'
          : riskRaw.includes('low')
            ? 'low'
            : 'unknown';

    const recs = Array.isArray(pred?.clinicalRecommendations)
      ? (pred.clinicalRecommendations as string[])
      : Array.isArray(pred?.recommendations)
        ? (pred.recommendations as string[])
        : [];

    const structured = {
      disclaimer:
        'Sugerencia de apoyo clínico generada por COP Medical AI. No sustituye diagnóstico ni juicio profesional.',
      risk_level: riskLevel,
      human_review_required: riskLevel === 'high' || riskRaw.includes('critical'),
      candidate_conditions: [],
      supporting_signals: recs.slice(0, 5),
      recommended_clarifying_questions: [
        '¿Ha habido cambios en adherencia al tratamiento en las últimas 4 semanas?',
      ],
      recommended_non_diagnostic_actions: recs.slice(0, 3),
      evidence_quotes_from_input: clinicalContext
        ? [clinicalContext.slice(0, 240)]
        : [],
    };

    return {
      id: String(pred?._id ?? pred?.id ?? randomUUID()),
      patientId,
      sourceType,
      status: assessed ? 'PENDING_REVIEW' : 'QUEUED',
      riskLevel,
      headline:
        riskLevel === 'high'
          ? 'Riesgo elevado — revisión prioritaria'
          : riskLevel === 'medium'
            ? 'Seguimiento recomendado'
            : 'Evaluación clínica registrada',
      structuredJson: JSON.stringify(structured),
      createdAt: new Date().toISOString(),
    };
  }
}
