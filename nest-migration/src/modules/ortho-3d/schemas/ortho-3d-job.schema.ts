import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type Ortho3dJobStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

@Schema({
  collection: 'ortho_3d_jobs',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Ortho3dJob extends Document {
  @Prop({ default: uuidv4 })
  _id: string;

  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ index: true })
  siteId?: string;

  @Prop({ required: true, index: true })
  patientId: string;

  @Prop({ required: true, index: true })
  externalJobId: string;

  @Prop({ required: true, index: true })
  status: Ortho3dJobStatus;

  @Prop()
  externalResultUrl?: string;

  @Prop()
  glbPublicUrl?: string;

  @Prop()
  glbStoragePath?: string;

  @Prop()
  errorMessage?: string;

  @Prop({ type: Number })
  inputImageCount?: number;
}

export const Ortho3dJobSchema = SchemaFactory.createForClass(Ortho3dJob);

