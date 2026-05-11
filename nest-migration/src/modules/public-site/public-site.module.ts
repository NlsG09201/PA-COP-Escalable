import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PublicSiteController } from './public-site.controller';
import { PublicSiteService } from './public-site.service';
import { PublicReview, PublicReviewSchema } from './schemas/public-review.schema';
import { PublicReviewsService } from './public-reviews.service';
import { PublicReviewsController } from './public-reviews.controller';
import { PublicReviewsAdminController } from './public-reviews-admin.controller';
import { IamModule } from '../iam/iam.module';
import { ColombianPaymentGatewayService } from './payments/colombian-payment-gateway.service';

@Module({
  imports: [IamModule, MongooseModule.forFeature([{ name: PublicReview.name, schema: PublicReviewSchema }])],
  controllers: [PublicSiteController, PublicReviewsController, PublicReviewsAdminController],
  providers: [PublicSiteService, PublicReviewsService, ColombianPaymentGatewayService],
})
export class PublicSiteModule {}

