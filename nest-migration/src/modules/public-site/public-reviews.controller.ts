import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CreatePublicReviewDto } from './dto/create-public-review.dto';
import { PublicReviewsService } from './public-reviews.service';

@ApiTags('public')
@Controller('public/reviews')
export class PublicReviewsController {
  constructor(private readonly reviews: PublicReviewsService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.reviews.listApproved(limit ? Number(limit) : 40);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  create(@Body() dto: CreatePublicReviewDto) {
    return this.reviews.create(dto);
  }
}
