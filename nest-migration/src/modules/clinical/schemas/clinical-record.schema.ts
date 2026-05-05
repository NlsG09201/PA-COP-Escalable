import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema()
export class ClinicalEntry {
  @Prop({ default: Date.now })
  at: Date;

  @Prop({ required: true })
  author_user_id: string;

  @Prop({ required: true })
  author_username: string;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  note: string;
}

@Schema({ collection: 'clinical_records' })
export class ClinicalRecord extends Document {
  @Prop({ default: uuidv4 })
  _id: string;

  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ index: true })
  siteId?: string;

  @Prop({ required: true, index: true })
  patientId: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;

  @Prop({ type: [ClinicalEntry], default: [] })
  entries: ClinicalEntry[];
}

export const ClinicalRecordSchema = SchemaFactory.createForClass(ClinicalRecord);
