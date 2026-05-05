import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema()
export class ToothClinicalState {
  @Prop()
  status: string;

  @Prop()
  updatedAt: Date;

  @Prop()
  braces?: boolean;

  @Prop({ type: [String], default: [] })
  damages?: string[];

  @Prop()
  diagnosis?: string;

  @Prop()
  treatment?: string;

  @Prop()
  clinicalObservations?: string;

  @Prop({ type: Array, default: [] })
  progressHistory?: any[];
}

@Schema({ collection: 'odontograms' })
export class Odontogram extends Document {
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

  @Prop({ type: Map, of: String })
  teeth?: Record<string, string>;

  @Prop({ type: Object })
  clinicalTeeth?: Record<string, ToothClinicalState>;

  @Prop({ type: Object })
  orthoSimulation?: any;

  @Prop({ type: Map, of: String })
  integrationExtensions?: Record<string, string>;
}

export const OdontogramSchema = SchemaFactory.createForClass(Odontogram);
