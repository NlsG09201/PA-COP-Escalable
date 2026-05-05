import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BaseDocument } from '../../../shared/schemas/base.schema';

export enum AppointmentStatus {
  REQUESTED = 'REQUESTED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED'
}

@Schema({ collection: 'appointments', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Appointment extends BaseDocument {
  @Prop({ required: true, index: true })
  professional_id: string;

  @Prop({ required: true, index: true })
  patient_id: string;

  @Prop({ required: true })
  start_at: Date;

  @Prop({ required: true })
  end_at: Date;

  @Prop({ type: String, enum: AppointmentStatus, default: AppointmentStatus.REQUESTED })
  status: AppointmentStatus;

  @Prop()
  reason: string;

  @Prop()
  service_offering_id: string;

  @Prop()
  service_name_snapshot: string;

  @Prop()
  service_category_snapshot: string;

  @Prop({ default: 0 })
  version: number;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
