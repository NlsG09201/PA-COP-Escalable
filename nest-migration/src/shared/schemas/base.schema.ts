import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export abstract class BaseDocument extends Document {
  @Prop({ default: uuidv4 })
  _id: string;

  @Prop({ required: true, index: true })
  organization_id: string;

  @Prop({ index: true })
  site_id: string;
}
