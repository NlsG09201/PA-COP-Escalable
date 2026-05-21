import { Module } from '@nestjs/common';
import {
  BudgetCompatController,
  CopilotCompatController,
  DiagnosisCompatController,
  EmotionCompatController,
  ExperienceCompatController,
  FollowupCompatController,
  TherapyCompatController,
} from './api-compat.controllers';
import { ApiCompatService } from './api-compat.service';

@Module({
  controllers: [
    DiagnosisCompatController,
    EmotionCompatController,
    BudgetCompatController,
    FollowupCompatController,
    TherapyCompatController,
    CopilotCompatController,
    ExperienceCompatController,
  ],
  providers: [ApiCompatService],
  exports: [ApiCompatService],
})
export class ApiCompatModule {}
