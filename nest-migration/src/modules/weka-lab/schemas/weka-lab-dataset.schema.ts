import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'weka_lab_datasets', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class WekaLabDataset extends Document {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ index: true })
  uploadedBy?: string;

  @Prop({ required: true })
  externalId: string;

  @Prop({ required: true })
  filename: string;

  @Prop()
  displayName?: string;

  @Prop({ required: true })
  format: string;

  @Prop({ required: true })
  rows: number;

  @Prop({ type: [String], default: [] })
  columns: string[];

  @Prop()
  defaultTarget?: string;

  @Prop({ type: [String], default: [] })
  defaultFeatures: string[];

  @Prop({ type: Object })
  columnTypes?: Record<string, string>;

  @Prop({ type: Object })
  meta?: Record<string, unknown>;
}

export const WekaLabDatasetSchema = SchemaFactory.createForClass(WekaLabDataset);
WekaLabDatasetSchema.index({ organizationId: 1, created_at: -1 });
