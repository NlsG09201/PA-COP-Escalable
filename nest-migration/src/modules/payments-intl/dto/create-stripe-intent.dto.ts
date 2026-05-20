import { IsEmail, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStripeIntentDto {
  @IsNumber()
  @Min(100)
  amountCents!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsEmail()
  patientEmail?: string;
}
