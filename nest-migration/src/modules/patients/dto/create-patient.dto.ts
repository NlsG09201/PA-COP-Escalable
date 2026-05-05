import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEmail, IsIn } from 'class-validator';

export class CreatePatientDto {
  @IsString()
  @IsOptional()
  external_code?: string;

  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsDateString()
  @IsOptional()
  birth_date?: string;

  @IsIn(['M', 'F', 'O'])
  @IsOptional()
  gender?: 'M' | 'F' | 'O';

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
