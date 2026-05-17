import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Patient extends Document {
  @Prop({ default: uuidv4 })
  _id: string;

  @Prop({ required: true })
  organization_id: string;

  @Prop()
  site_id: string;

  @Prop()
  external_code: string;

  @Prop({ required: true })
  full_name: string;

  @Prop()
  birth_date: Date;

  @Prop()
  gender?: string;

  @Prop()
  phone: string;

  @Prop()
  email: string;

  @Prop({ default: 'ACTIVE' })
  status: string;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);

PatientSchema.index({ organization_id: 1, site_id: 1, status: 1 });
PatientSchema.index({ organization_id: 1, full_name: 1 });
PatientSchema.index({ organization_id: 1, email: 1 });
