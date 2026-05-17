import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({ collection: 'users', timestamps: true })
export class UserAccount extends Document {
  @Prop({ default: uuidv4 })
  _id: string;

  @Prop({ required: true })
  organization_id: string;

  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ sparse: true })
  email?: string;

  @Prop({ required: true })
  password_hash: string;

  // Link to `patients._id` (UUID stored as string in token/user collection).
  @Prop()
  patient_id?: string;

  @Prop({ type: [String], default: [] })
  roles: string[];

  @Prop({ default: false })
  mfa_enabled: boolean;
}

export const UserAccountSchema = SchemaFactory.createForClass(UserAccount);
