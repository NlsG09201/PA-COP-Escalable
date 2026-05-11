import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PublicReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

@Schema({ collection: 'public_reviews', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class PublicReview extends Document {
  @Prop({ required: true, maxlength: 80 })
  authorName: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ required: true, maxlength: 900 })
  comment: string;

  @Prop({ required: true, default: 'PENDING', index: true })
  status: PublicReviewStatus;
}

export const PublicReviewSchema = SchemaFactory.createForClass(PublicReview);
