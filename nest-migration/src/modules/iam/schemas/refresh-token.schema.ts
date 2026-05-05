import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BaseDocument } from '../../../shared/schemas/base.schema';

@Schema({ collection: 'refresh_tokens' })
export class RefreshToken extends BaseDocument {
  @Prop({ required: true, index: true })
  user_id: string;

  @Prop({ required: true, unique: true })
  token_hash: string;

  @Prop({ required: true })
  expires_at: Date;

  @Prop()
  issued_at: Date;

  @Prop()
  ip_address: string;

  @Prop()
  user_agent: string;

  @Prop({ default: false })
  mfa_verified: boolean;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
