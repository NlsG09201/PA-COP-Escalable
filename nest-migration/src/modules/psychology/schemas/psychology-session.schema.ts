import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PsychologySessionDocument = HydratedDocument<PsychologySession>;

@Schema({ collection: 'psychology_sessions', timestamps: true })
export class PsychologySession {
  @Prop({ required: true, index: true })
  patientId!: string;

  @Prop({ required: true, index: true })
  organizationId!: string;

  @Prop({ index: true })
  siteId?: string;

  @Prop({ required: true })
  professionalUserId!: string;

  @Prop({ default: 'INDIVIDUAL' })
  sessionType!: string;

  @Prop()
  clinicalGoal?: string;

  @Prop()
  clinicalNotes?: string;

  @Prop({ type: Object })
  emotionalState?: Record<string, unknown>;

  @Prop({ type: Object })
  scaleScores?: Record<string, number>;

  @Prop()
  dsmCategory?: string;

  @Prop()
  dsmCode?: string;

  @Prop({ default: 'SCHEDULED' })
  status!: string;

  @Prop()
  occurredAt?: Date;

  @Prop({ default: 0 })
  durationMinutes!: number;

  @Prop({ type: [String], default: [] })
  tags!: string[];
}

export const PsychologySessionSchema = SchemaFactory.createForClass(PsychologySession);
PsychologySessionSchema.index({ patientId: 1, occurredAt: -1 });
PsychologySessionSchema.index({ organizationId: 1, occurredAt: -1 });
