import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PsychologicalEvaluationDocument = HydratedDocument<PsychologicalEvaluation>;

@Schema({ collection: 'psychological_evaluations', timestamps: true })
export class PsychologicalEvaluation {
  @Prop({ required: true, index: true })
  patientId!: string;

  @Prop({ required: true, index: true })
  organizationId!: string;

  @Prop({ index: true })
  siteId?: string;

  @Prop({ required: true })
  scaleId!: string;

  @Prop({ required: true })
  scaleName!: string;

  @Prop({ type: Object, required: true })
  responses!: Record<string, number>;

  @Prop({ required: true })
  totalScore!: number;

  @Prop()
  severity?: string;

  @Prop()
  interpretation?: string;

  @Prop()
  evaluatedAt?: Date;

  @Prop()
  evaluatedByUserId?: string;
}

export const PsychologicalEvaluationSchema = SchemaFactory.createForClass(PsychologicalEvaluation);
PsychologicalEvaluationSchema.index({ patientId: 1, evaluatedAt: -1 });
