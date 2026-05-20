import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AssistantThreadDocument = HydratedDocument<AssistantThread>;

@Schema({ _id: false })
export class AssistantMessage {
  @Prop({ required: true, enum: ['user', 'assistant', 'system'] })
  role!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ default: () => new Date() })
  at!: Date;
}

@Schema({ collection: 'medical_ai_assistant_threads', timestamps: true })
export class AssistantThread {
  @Prop({ required: true, index: true })
  organizationId!: string;

  @Prop({ required: true, index: true })
  patientId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ type: [AssistantMessage], default: [] })
  messages!: AssistantMessage[];

  @Prop()
  lastSummary?: string;
}

export const AssistantThreadSchema = SchemaFactory.createForClass(AssistantThread);
AssistantThreadSchema.index({ organizationId: 1, patientId: 1, userId: 1 }, { unique: true });
