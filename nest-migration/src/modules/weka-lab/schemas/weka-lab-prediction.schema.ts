import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'weka_lab_predictions', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class WekaLabPrediction extends Document {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ index: true })
  createdBy?: string;

  @Prop()
  modelId?: string;

  @Prop({ type: Object })
  inputFeatures?: Record<string, unknown>;

  @Prop()
  classLabel?: string;

  @Prop({ type: Object })
  probabilities?: Record<string, number>;

  @Prop()
  riskLevel?: string;

  @Prop()
  riskScore?: number;

  @Prop()
  psychologicalScore?: number;

  @Prop({ type: [String], default: [] })
  recommendations: string[];
}

export const WekaLabPredictionSchema = SchemaFactory.createForClass(WekaLabPrediction);
WekaLabPredictionSchema.index({ organizationId: 1, created_at: -1 });
