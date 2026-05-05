import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PatientController } from './patients.controller';
import { PatientService } from './patients.service';
import { Patient, PatientSchema } from './patient.schema';
import { IamModule } from '../iam/iam.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Patient.name, schema: PatientSchema }]),
    IamModule,
  ],
  controllers: [PatientController],
  providers: [PatientService],
})
export class PatientsModule {}
