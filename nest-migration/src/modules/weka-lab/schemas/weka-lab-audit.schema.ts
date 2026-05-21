import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'weka_lab_audits', timestamps: { createdAt: 'created_at', updatedAt: false } })
export class WekaLabAudit extends Document {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ index: true })
  userId?: string;

  @Prop({ required: true })
  action: string;

  @Prop({ type: Object })
  payload?: Record<string, unknown>;

  @Prop()
  ip?: string;
}

export const WekaLabAuditSchema = SchemaFactory.createForClass(WekaLabAudit);
WekaLabAuditSchema.index({ organizationId: 1, created_at: -1 });
