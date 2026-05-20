import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MedicalAiPredictionDocument = HydratedDocument<MedicalAiPrediction>;

@Schema({ collection: 'medical_ai_predictions', timestamps: true })
export class MedicalAiPrediction {
  @Prop({ required: true, index: true })
  organizationId!: string;

  @Prop({ index: true })
  siteId?: string;

  @Prop({ required: true, index: true })
  patientId!: string;

  @Prop({ required: true })
  ensembleProbability!: number;

  @Prop({ required: true })
  riskLevel!: string;

  @Prop({ required: true })
  dynamicPsychologicalScore!: number;

  @Prop({ type: [Object], default: [] })
  modelVotes!: Array<{ model: string; relapseProbability: number; riskLevel: string }>;

  @Prop({ type: [String], default: [] })
  clinicalRecommendations!: string[];

  @Prop({ default: false })
  earlyWarning!: boolean;

  @Prop({ default: 0 })
  confidence!: number;

  @Prop({ type: Object })
  featureSnapshot?: Record<string, unknown>;

  @Prop({ type: Object })
  scores?: {
    mentalHealth: number;
    relapseRisk: number;
    adherence: number;
    dropoutRisk: number;
    urgency: number;
  };
}

export const MedicalAiPredictionSchema = SchemaFactory.createForClass(MedicalAiPrediction);
MedicalAiPredictionSchema.index({ organizationId: 1, createdAt: -1 });
MedicalAiPredictionSchema.index({ patientId: 1, createdAt: -1 });
