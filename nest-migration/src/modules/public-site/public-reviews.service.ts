import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreatePublicReviewDto } from './dto/create-public-review.dto';
import { PublicReview } from './schemas/public-review.schema';
import { ModeratePublicReviewDto } from './dto/moderate-public-review.dto';

@Injectable()
export class PublicReviewsService {
  constructor(@InjectModel(PublicReview.name) private readonly reviews: Model<PublicReview>) {}

  listApproved(limit = 40) {
    const cap = Math.min(100, Math.max(1, limit));
    return this.reviews
      .find({ status: 'APPROVED' })
      .sort({ created_at: -1 })
      .limit(cap)
      .select('authorName rating comment created_at')
      .lean()
      .exec();
  }

  async create(dto: CreatePublicReviewDto) {
    const doc = await this.reviews.create({
      authorName: dto.authorName,
      rating: dto.rating,
      comment: dto.comment,
      status: 'PENDING',
    });
    return { ok: true, id: String(doc._id), message: 'Reseña enviada; será visible tras moderación.' };
  }

  listForModeration(status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL', limit = 100) {
    const cap = Math.min(300, Math.max(1, limit));
    const q = status === 'ALL' ? {} : { status };
    return this.reviews.find(q).sort({ created_at: -1 }).limit(cap).lean().exec();
  }

  async moderate(id: string, dto: ModeratePublicReviewDto) {
    const doc = await this.reviews.findByIdAndUpdate(id, { $set: { status: dto.status } }, { new: true }).lean().exec();
    if (!doc) throw new NotFoundException('Review not found');
    return doc;
  }
}
