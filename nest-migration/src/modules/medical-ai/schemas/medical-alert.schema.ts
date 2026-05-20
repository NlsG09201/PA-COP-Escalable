import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MedicalAlertDocument = HydratedDocument<MedicalAlert>;

@Schema({ collection: 'medical_ai_alerts', timestamps: true })
export class MedicalAlert {
  @Prop({ required: true, index: true })
  organizationId!: string;

  @Prop({ index: true })
  siteId?: string;

  @Prop({ required: true, index: true })
  patientId!: string;

  @Prop({ required: true })
  patientName!: string;

  @Prop({ required: true, enum: ['RELAPSE_RISK', 'THERAPY_DROP', 'CRITICAL_BEHAVIOR', 'DENTAL_URGENCY', 'AI_INSIGHT'] })
  alertType!: string;

  @Prop({ required: true, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  severity!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  message!: string;

  @Prop({ type: [String], default: [] })
  recommendations!: string[];

  @Prop({ default: 0 })
  priorityScore!: number;

  @Prop({ default: 'OPEN' })
  status!: string;

  @Prop()
  acknowledgedAt?: Date;

  @Prop()
  acknowledgedByUserId?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const MedicalAlertSchema = SchemaFactory.createForClass(MedicalAlert);
MedicalAlertSchema.index({ organizationId: 1, status: 1, priorityScore: -1 });
MedicalAlertSchema.index({ patientId: 1, createdAt: -1 });
