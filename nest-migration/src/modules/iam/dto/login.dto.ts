import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @Transform(({ value }) => {
    const s = typeof value === 'string' ? value.trim() : value;
    return s === '' || s == null ? undefined : s;
  })
  @IsUUID()
  @IsOptional()
  siteId?: string;
}
