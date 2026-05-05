import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { Patient, PatientSchema } from '../patients/patient.schema';
import { Professional, ProfessionalSchema } from '../tenancy/schemas/professional.schema';
import { AnalyticsDashboardController } from './analytics-dashboard.controller';
import { AnalyticsDashboardService } from './analytics-dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Patient.name, schema: PatientSchema },
      { name: Professional.name, schema: ProfessionalSchema },
    ]),
  ],
  controllers: [AnalyticsDashboardController],
  providers: [AnalyticsDashboardService],
})
export class AnalyticsDashboardModule {}

