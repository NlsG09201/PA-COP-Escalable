import { Module } from '@nestjs/common';
import {
  BudgetCompatController,
  CopilotCompatController,
  DiagnosisCompatController,
  EmotionCompatController,
  ExperienceCompatController,
  FollowupCompatController,
  PsychologyCompatController,
  PsychTestsCompatController,
  RelapseCompatController,
  TherapyCompatController,
} from './api-compat.controllers';

@Module({
  controllers: [
    DiagnosisCompatController,
    BudgetCompatController,
    FollowupCompatController,
    PsychologyCompatController,
    EmotionCompatController,
    TherapyCompatController,
    RelapseCompatController,
    PsychTestsCompatController,
    CopilotCompatController,
    ExperienceCompatController,
  ],
})
export class ApiCompatModule {}
