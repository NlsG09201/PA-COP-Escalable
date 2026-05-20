import { IsArray, IsDateString, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePsychologySessionDto {
  @IsOptional()
  @IsString()
  sessionType?: string;

  @IsOptional()
  @IsString()
  clinicalGoal?: string;

  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @IsOptional()
  @IsObject()
  emotionalState?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  scaleScores?: Record<string, number>;

  @IsOptional()
  @IsString()
  dsmCategory?: string;

  @IsOptional()
  @IsString()
  dsmCode?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(180)
  durationMinutes?: number;

  @IsOptional()
  @IsArray()
  tags?: string[];
}
