import { IsOptional, IsString, MinLength } from 'class-validator';

/** Token ID de Google Sign-In (OAuth 2.0). Requiere GOOGLE_CLIENT_ID en el servidor. */
export class GoogleAuthDto {
  @IsString()
  @MinLength(20)
  idToken: string;

  @IsOptional()
  @IsString()
  siteId?: string;
}
