import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength, IsIn } from 'class-validator';

export class RegisterPublicDto {
  @IsUUID()
  siteId: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  birthDate?: string; // YYYY-MM-DD

  @IsIn(['M', 'F', 'O'])
  @IsOptional()
  gender?: 'M' | 'F' | 'O';
}

