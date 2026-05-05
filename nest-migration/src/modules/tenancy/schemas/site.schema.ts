import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({ collection: 'sites', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Site extends Document {
  @Prop({ default: uuidv4 })
  _id: string;

  @Prop({ required: true, index: true })
  organization_id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  timezone: string;

  @Prop({ default: 'ACTIVE' })
  status: string;
}

export const SiteSchema = SchemaFactory.createForClass(Site);
