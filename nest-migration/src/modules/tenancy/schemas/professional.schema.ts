import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({ collection: 'professionals', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Professional extends Document {
  @Prop({ default: uuidv4 })
  _id: string;

  @Prop({ required: true, index: true })
  organization_id: string;

  @Prop({ index: true })
  default_site_id: string;

  @Prop({ required: true })
  full_name: string;

  @Prop({ required: true })
  specialty: string;

  @Prop({ default: 'ACTIVE' })
  status: string;
}

export const ProfessionalSchema = SchemaFactory.createForClass(Professional);
