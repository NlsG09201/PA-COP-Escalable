import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { AssistantThread } from './schemas/assistant-thread.schema';
import { TenantContext } from '../tenancy/tenancy.interceptor';
import { MedicalAiTimelineService } from './medical-ai-timeline.service';
import { MedicalAiPredictionService } from './medical-ai-prediction.service';
import { MedicalAiPrediction } from './schemas/medical-ai-prediction.schema';
import { Patient } from '../patients/patient.schema';
import { PsychologySession } from '../psychology/schemas/psychology-session.schema';

@Injectable()
export class MedicalAiAssistantService {
  constructor(
    @InjectModel(AssistantThread.name) private readonly threads: Model<AssistantThread>,
    @InjectModel(Patient.name) private readonly patients: Model<Patient>,
    @InjectModel(PsychologySession.name) private readonly sessions: Model<PsychologySession>,
    @InjectModel(MedicalAiPrediction.name) private readonly predictionDocs: Model<MedicalAiPrediction>,
    private readonly timeline: MedicalAiTimelineService,
    private readonly predictions: MedicalAiPredictionService,
    private readonly config: ConfigService,
  ) {}

  private async clinicalContext(patientId: string, tenant: TenantContext) {
    const patient = await this.patients
      .findOne({ _id: patientId, organization_id: tenant.organizationId })
      .lean()
      .exec();
    const { events, analysis } = await this.timeline.buildTimeline(patientId, tenant);
    const latest = await this.predictions.latestForPatient(patientId, tenant);
    const recentSessions = await this.sessions
      .find({ patientId, organizationId: tenant.organizationId })
      .sort({ occurredAt: -1 })
      .limit(5)
      .lean()
      .exec();

    return {
      patientName: String((patient as { full_name?: string })?.full_name ?? 'Paciente'),
      timelineSummary: events.slice(0, 12).map((e) => `${e.at.slice(0, 10)} [${e.domain}] ${e.title}: ${e.summary}`),
      trend: analysis.trend,
      futureRisk: analysis.futureRisk,
      correlations: analysis.correlations,
      latestPrediction: latest
        ? {
            riskLevel: latest.riskLevel,
            score: latest.dynamicPsychologicalScore,
            recommendations: latest.clinicalRecommendations,
          }
        : null,
      recentSessionNotes: recentSessions.map((s) => String(s.clinicalNotes ?? '').slice(0, 200)).filter(Boolean),
    };
  }

  private buildDeterministicReply(ctx: Awaited<ReturnType<MedicalAiAssistantService['clinicalContext']>>, question: string) {
    const lines: string[] = [];
    lines.push(`**Resumen clínico — ${ctx.patientName}**`);
    lines.push(`- Tendencia emocional: **${ctx.trend}**`);
    lines.push(`- Riesgo futuro estimado: ${ctx.futureRisk}`);
    if (ctx.latestPrediction) {
      lines.push(
        `- Última predicción IA: nivel **${ctx.latestPrediction.riskLevel}**, score dinámico **${ctx.latestPrediction.score}**`,
      );
      if (ctx.latestPrediction.recommendations?.length) {
        lines.push('- Recomendaciones automáticas:');
        for (const r of ctx.latestPrediction.recommendations.slice(0, 4)) lines.push(`  • ${r}`);
      }
    }
    if (ctx.correlations.length) {
      lines.push('- Correlaciones detectadas:');
      for (const c of ctx.correlations) lines.push(`  • ${c}`);
    }
    lines.push('');
    lines.push('**Evolución reciente (timeline):**');
    for (const t of ctx.timelineSummary.slice(0, 6)) lines.push(`- ${t}`);
    lines.push('');
    lines.push('**Preguntas clínicas sugeridas:**');
    lines.push('- ¿Ha notado cambios en sueño, apetito o aislamiento social en las últimas 2 semanas?');
    lines.push('- ¿Qué factores desencadenaron el último episodio de malestar reportado?');
    lines.push('- ¿Cuál es el nivel de adherencia al plan terapéutico y medicación?');
    if (question.trim()) {
      lines.push('');
      lines.push(`**Respuesta orientada a:** "${question.trim()}"`);
      if (ctx.trend === 'DETERIORATING') {
        lines.push('Priorizar evaluación de riesgo, intensificar seguimiento y considerar derivación si persisten síntomas.');
      } else if (ctx.trend === 'IMPROVING') {
        lines.push('Mantener plan actual y reforzar factores protectores identificados en sesiones recientes.');
      } else {
        lines.push('Continuar monitoreo estructurado con escalas GAD-7/PHQ-9 en próxima sesión.');
      }
    }
    return lines.join('\n');
  }

  private async callOpenAi(system: string, user: string): Promise<string | null> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) return null;
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content?.trim() ?? null;
    } catch {
      return null;
    }
  }

  async chat(
    patientId: string,
    tenant: TenantContext,
    userId: string,
    message: string,
  ): Promise<{ reply: string; threadId: string; provider: string }> {
    const ctx = await this.clinicalContext(patientId, tenant);
    const systemPrompt =
      'Eres un asistente clínico para psicología y odontología. Responde en español, con precisión, sin inventar diagnósticos definitivos. Sugiere acciones basadas en datos.';

    const userPrompt = `Contexto JSON:\n${JSON.stringify(ctx)}\n\nPregunta del clínico:\n${message}`;

    let reply = await this.callOpenAi(systemPrompt, userPrompt);
    let provider = 'openai';
    if (!reply) {
      reply = this.buildDeterministicReply(ctx, message);
      provider = 'clinical-engine';
    }

    const thread = await this.threads.findOneAndUpdate(
      { organizationId: tenant.organizationId, patientId, userId },
      {
        $setOnInsert: { organizationId: tenant.organizationId, patientId, userId },
        $push: {
          messages: {
            $each: [
              { role: 'user', content: message, at: new Date() },
              { role: 'assistant', content: reply, at: new Date() },
            ],
          },
        },
        $set: { lastSummary: reply.slice(0, 500) },
      },
      { upsert: true, new: true },
    );

    return { reply, threadId: String(thread._id), provider };
  }

  async summarize(patientId: string, tenant: TenantContext, userId: string) {
    return this.chat(
      patientId,
      tenant,
      userId,
      'Genera un resumen ejecutivo del historial clínico, evolución y riesgos para la próxima consulta.',
    );
  }

  async suggestQuestions(patientId: string, tenant: TenantContext, userId: string) {
    return this.chat(
      patientId,
      tenant,
      userId,
      'Sugiere preguntas clínicas prioritarias para la próxima sesión basadas en el historial.',
    );
  }

  async prioritizePatients(tenant: TenantContext, limit = 15) {
    const preds = await this.predictionDocs
      .find({ organizationId: tenant.organizationId })
      .sort({ 'scores.urgency': -1, createdAt: -1 })
      .limit(limit * 3)
      .lean()
      .exec();

    const seen = new Set<string>();
    const ranked: Array<{
      patientId: string;
      urgency: number;
      riskLevel: string;
      dynamicScore: number;
    }> = [];

    for (const p of preds) {
      if (seen.has(p.patientId)) continue;
      seen.add(p.patientId);
      ranked.push({
        patientId: p.patientId,
        urgency: p.scores?.urgency ?? Math.round(p.ensembleProbability * 100),
        riskLevel: p.riskLevel,
        dynamicScore: p.dynamicPsychologicalScore,
      });
      if (ranked.length >= limit) break;
    }
    return ranked;
  }
}
