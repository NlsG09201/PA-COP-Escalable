import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MedicalInsightDocument = HydratedDocument<MedicalInsight>;

@Schema({ collection: 'medical_ai_insights', timestamps: true })
export class MedicalInsight {
  @Prop({ required: true, index: true })
  organizationId!: string;

  @Prop({ index: true })
  siteId?: string;

  @Prop()
  patientId?: string;

  @Prop({ required: true })
  category!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  summary!: string;

  @Prop({ type: Object })
  statistics?: Record<string, unknown>;

  @Prop({ type: [String], default: [] })
  correlations!: string[];

  @Prop({ default: 0 })
  impactScore!: number;
}

export const MedicalInsightSchema = SchemaFactory.createForClass(MedicalInsight);
MedicalInsightSchema.index({ organizationId: 1, impactScore: -1, createdAt: -1 });
