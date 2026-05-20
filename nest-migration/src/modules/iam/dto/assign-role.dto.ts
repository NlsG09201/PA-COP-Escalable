import { IsIn, IsString, MinLength } from 'class-validator';

const ASSIGNABLE_ROLES = [
  'MEDICO',
  'PROFESSIONAL',
  'ODONTOLOGO',
  'PSICOLOGO',
  'RECEPCIONISTA',
  'PACIENTE',
  'ORG_ADMIN',
  'SITE_ADMIN',
  'ADMIN',
] as const;

export class AssignRoleDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsIn(ASSIGNABLE_ROLES)
  role: (typeof ASSIGNABLE_ROLES)[number];
}
