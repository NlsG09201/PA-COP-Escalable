import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Patient, PatientSchema } from '../patients/patient.schema';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { PsychologicalSnapshot, PsychologicalSnapshotSchema } from './schemas/psychological-snapshot.schema';
import { J48Prediction, J48PredictionSchema } from './schemas/j48-prediction.schema';
import { J48ScoringController } from './j48-scoring.controller';
import { J48ScoringService } from './j48-scoring.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Patient.name, schema: PatientSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: PsychologicalSnapshot.name, schema: PsychologicalSnapshotSchema },
      { name: J48Prediction.name, schema: J48PredictionSchema },
    ]),
  ],
  controllers: [J48ScoringController],
  providers: [J48ScoringService],
})
export class J48ScoringModule {}

