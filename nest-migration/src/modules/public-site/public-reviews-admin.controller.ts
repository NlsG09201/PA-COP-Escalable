import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { ModeratePublicReviewDto } from './dto/moderate-public-review.dto';
import { PublicReviewsService } from './public-reviews.service';

@ApiTags('admin-public-reviews')
@ApiBearerAuth()
@Controller('api/admin/public-reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PublicReviewsAdminController {
  constructor(private readonly reviews: PublicReviewsService) {}

  @Get()
  @Roles('ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'SUPER_ADMIN')
  list(@Query('status') status: string = 'PENDING', @Query('limit') limit?: string) {
    const s = (['PENDING', 'APPROVED', 'REJECTED', 'ALL'].includes(status) ? status : 'PENDING') as
      | 'PENDING'
      | 'APPROVED'
      | 'REJECTED'
      | 'ALL';
    return this.reviews.listForModeration(s, limit ? Number(limit) : 100);
  }

  @Patch(':id')
  @Roles('ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'SUPER_ADMIN')
  moderate(@Param('id') id: string, @Body() dto: ModeratePublicReviewDto) {
    return this.reviews.moderate(id, dto);
  }
}
