import { IsOptional, IsString, MinLength } from 'class-validator';

export class SetupBootstrapDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
