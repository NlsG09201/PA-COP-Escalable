import { IsNumber, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreatePayPalOrderDto {
  @IsNumber()
  @Min(0.5)
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUrl()
  returnUrl!: string;

  @IsUrl()
  cancelUrl!: string;
}
