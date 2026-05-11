import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { COLOMBIA_CHECKOUT_PROVIDER_KEYS } from '../payments/colombian-payment.constants';

export class CreatePublicPaymentIntentDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  idempotencyKey?: string;

  @IsOptional()
  @IsIn([...COLOMBIA_CHECKOUT_PROVIDER_KEYS])
  providerKey?: string;

  /** Nequi / Daviplata */
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    const d = String(value).replace(/\D/g, '');
    return d.length ? d : undefined;
  })
  @IsString()
  @MaxLength(12)
  walletPhone?: string;

  /** PSE pagador */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  pseLegalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  pseLegalIdType?: string;

  @IsOptional()
  @IsIn(['PERSON', 'BUSINESS'])
  pseUserType?: 'PERSON' | 'BUSINESS';

  /** Token del widget PSP (tarjeta) */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cardPaymentSourceToken?: string;

  /** Respuesta GET /public/payments/wompi-presets tras aceptacion por checkbox */
  @IsOptional()
  @IsString()
  wompiAcceptanceToken?: string;

  @IsOptional()
  @IsString()
  wompiPersonalAuth?: string;
}
