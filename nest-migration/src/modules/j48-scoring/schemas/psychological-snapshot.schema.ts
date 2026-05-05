import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'psychological_snapshots' })
export class PsychologicalSnapshot extends Document {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ index: true })
  siteId?: string;

  @Prop({ required: true, index: true })
  patientId: string;

  @Prop({ required: true })
  occurredAt: Date;

  @Prop()
  predominantSentiment?: string;

  @Prop()
  sentimentScore?: number;

  @Prop({ type: Object })
  metrics?: Record<string, unknown>;
}

export const PsychologicalSnapshotSchema = SchemaFactory.createForClass(PsychologicalSnapshot);

