import { IsUUID } from 'class-validator';

export class ClaimAppointmentDto {
  @IsUUID()
  professionalId!: string;
}
