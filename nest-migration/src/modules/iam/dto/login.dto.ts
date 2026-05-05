import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsUUID()
  @IsOptional()
  siteId?: string;
}
