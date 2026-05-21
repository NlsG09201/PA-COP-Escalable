import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class ClinicalPredictDto {
  @IsOptional()
  @IsString()
  modelId?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  age_group?: string;

  @IsOptional()
  @IsString()
  sentiment?: string;

  @IsOptional()
  @IsString()
  wellbeing?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  anxiety?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  depression?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  stress?: number;

  @IsOptional()
  @IsString()
  attendance?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  days_since_last?: number;

  @IsOptional()
  @IsString()
  adherence?: string;

  @IsOptional()
  @IsString()
  symptoms?: string;

  @IsOptional()
  @IsString()
  prior_relapse?: string;

  @IsOptional()
  @IsString()
  emotional_state?: string;
}
