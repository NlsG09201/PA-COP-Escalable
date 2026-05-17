import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'j48_predictions', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class J48Prediction extends Document {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ index: true })
  siteId?: string;

  @Prop({ required: true, index: true })
  patientId: string;

  @Prop({ required: true })
  scoredAt: Date;

  @Prop({ type: Object, required: true })
  features: Record<string, unknown>;

  @Prop({ required: true })
  classLabel: string;

  @Prop({ type: Object })
  probabilities?: Record<string, number>;
}

export const J48PredictionSchema = SchemaFactory.createForClass(J48Prediction);

J48PredictionSchema.index({ organizationId: 1, patientId: 1, scoredAt: -1 });
J48PredictionSchema.index({ organizationId: 1, scoredAt: -1 });

