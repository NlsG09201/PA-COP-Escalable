import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'weka_lab_models', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class WekaLabModel extends Document {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ index: true })
  trainedBy?: string;

  @Prop({ required: true, unique: true })
  externalId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: '1.0.0' })
  version: string;

  @Prop()
  datasetId?: string;

  @Prop({ type: [String], default: [] })
  featureColumns: string[];

  @Prop()
  targetColumn?: string;

  @Prop({ type: Object })
  hyperparameters?: Record<string, unknown>;

  @Prop({ type: Object })
  metrics?: Record<string, unknown>;

  @Prop()
  engine?: string;

  @Prop({ default: false })
  isActive: boolean;

  @Prop()
  trainedAt?: Date;
}

export const WekaLabModelSchema = SchemaFactory.createForClass(WekaLabModel);
WekaLabModelSchema.index({ organizationId: 1, trainedAt: -1 });
WekaLabModelSchema.index({ organizationId: 1, isActive: 1 });
