import { IsIn } from 'class-validator';

export class ModeratePublicReviewDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';
}
