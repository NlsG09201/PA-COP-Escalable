import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  birthDate?: string; // YYYY-MM-DD

  @IsIn(['M', 'F', 'O'])
  @IsOptional()
  gender?: 'M' | 'F' | 'O';

  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;
}

