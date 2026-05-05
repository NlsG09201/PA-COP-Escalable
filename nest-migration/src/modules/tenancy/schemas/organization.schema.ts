import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({ collection: 'organizations', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Organization extends Document {
  @Prop({ default: uuidv4 })
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: 'ACTIVE' })
  status: string;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
