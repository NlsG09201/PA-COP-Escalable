import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PsychologyController } from './psychology.controller';
import { PsychTestsAliasController } from './psych-tests-alias.controller';
import { PsychologyService } from './psychology.service';
import { PsychologySession, PsychologySessionSchema } from './schemas/psychology-session.schema';
import {
  PsychologicalEvaluation,
  PsychologicalEvaluationSchema,
} from './schemas/psychological-evaluation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PsychologySession.name, schema: PsychologySessionSchema },
      { name: PsychologicalEvaluation.name, schema: PsychologicalEvaluationSchema },
    ]),
  ],
  controllers: [PsychologyController, PsychTestsAliasController],
  providers: [PsychologyService],
  exports: [PsychologyService],
})
export class PsychologyModule {}
