import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreatePsychologicalEvaluationDto {
  @IsString()
  scaleId!: string;

  @IsObject()
  responses!: Record<string, number>;

  @IsOptional()
  @IsString()
  interpretation?: string;
}
