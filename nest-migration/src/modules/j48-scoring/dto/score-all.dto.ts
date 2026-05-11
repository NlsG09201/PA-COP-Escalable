import { IsOptional, IsString } from 'class-validator';

/** organizationId requerida para SUPER_ADMIN; el resto usa la del token. */
export class ScoreAllDto {
  @IsOptional()
  @IsString()
  organizationId?: string;
}
