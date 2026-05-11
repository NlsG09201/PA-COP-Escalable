import { IsOptional, IsString, MinLength } from 'class-validator';

/** organizationId solo aplica a SUPER_ADMIN para apuntar a otro tenant. */
export class ScorePatientDto {
  @IsString()
  @MinLength(1)
  patientId!: string;

  @IsOptional()
  @IsString()
  organizationId?: string;
}
