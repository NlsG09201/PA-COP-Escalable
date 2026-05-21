import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { resolveRedisUrl } from '../../config/env.validation';
import { isRedisUrlLooksValid } from '../../config/redis.client';
import { IamModule } from '../iam/iam.module';
import { J48ScoringModule } from '../j48-scoring/j48-scoring.module';
import { Patient, PatientSchema } from '../patients/patient.schema';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { PsychologySession, PsychologySessionSchema } from '../psychology/schemas/psychology-session.schema';
import {
  PsychologicalEvaluation,
  PsychologicalEvaluationSchema,
} from '../psychology/schemas/psychological-evaluation.schema';
import { J48Prediction, J48PredictionSchema } from '../j48-scoring/schemas/j48-prediction.schema';
import { ClinicalRecord, ClinicalRecordSchema } from '../clinical/schemas/clinical-record.schema';
import { MedicalAlert, MedicalAlertSchema } from './schemas/medical-alert.schema';
import { MedicalAiPrediction, MedicalAiPredictionSchema } from './schemas/medical-ai-prediction.schema';
import { MedicalInsight, MedicalInsightSchema } from './schemas/medical-insight.schema';
import { AssistantThread, AssistantThreadSchema } from './schemas/assistant-thread.schema';
import { MedicalAiController, RelapseCompatController } from './medical-ai.controller';
import { AiAssistAliasController } from './ai-assist-alias.controller';
import { MedicalAiService } from './medical-ai.service';
import { MedicalAiPredictionService } from './medical-ai-prediction.service';
import { MedicalAiAlertsService } from './medical-ai-alerts.service';
import { MedicalAiTimelineService } from './medical-ai-timeline.service';
import { MedicalAiAssistantService } from './medical-ai-assistant.service';
import { MedicalAiInsightsService } from './medical-ai-insights.service';
import { MedicalAiDashboardService } from './medical-ai-dashboard.service';
import { MedicalAiGateway } from './medical-ai.gateway';
import { MedicalAiProcessor, MEDICAL_AI_QUEUE } from './medical-ai.processor';
import { RelapseReadService } from './relapse-read.service';

const redisUrl = isRedisUrlLooksValid() ? resolveRedisUrl() : '';

@Module({
  imports: [
    IamModule,
    J48ScoringModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: Patient.name, schema: PatientSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: PsychologySession.name, schema: PsychologySessionSchema },
      { name: PsychologicalEvaluation.name, schema: PsychologicalEvaluationSchema },
      { name: J48Prediction.name, schema: J48PredictionSchema },
      { name: ClinicalRecord.name, schema: ClinicalRecordSchema },
      { name: MedicalAlert.name, schema: MedicalAlertSchema },
      { name: MedicalAiPrediction.name, schema: MedicalAiPredictionSchema },
      { name: MedicalInsight.name, schema: MedicalInsightSchema },
      { name: AssistantThread.name, schema: AssistantThreadSchema },
    ]),
    ...(redisUrl
      ? [
          BullModule.forRoot({ connection: { url: redisUrl } }),
          BullModule.registerQueue({ name: MEDICAL_AI_QUEUE }),
        ]
      : []),
  ],
  controllers: [MedicalAiController, RelapseCompatController, AiAssistAliasController],
  providers: [
    MedicalAiService,
    MedicalAiPredictionService,
    MedicalAiAlertsService,
    MedicalAiTimelineService,
    MedicalAiAssistantService,
    MedicalAiInsightsService,
    MedicalAiDashboardService,
    RelapseReadService,
    MedicalAiGateway,
    ...(redisUrl
      ? [MedicalAiProcessor]
      : [{ provide: getQueueToken(MEDICAL_AI_QUEUE), useValue: null }]),
  ],
  exports: [MedicalAiService, MedicalAiGateway],
})
export class MedicalAiModule {}
