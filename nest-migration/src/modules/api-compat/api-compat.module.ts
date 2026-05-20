import { Module } from '@nestjs/common';
import {
  BudgetCompatController,
  CopilotCompatController,
  ExperienceCompatController,
  FollowupCompatController,
  TherapyCompatController,
} from './api-compat.controllers';

@Module({
  controllers: [
    BudgetCompatController,
    FollowupCompatController,
    TherapyCompatController,
    CopilotCompatController,
    ExperienceCompatController,
  ],
})
export class ApiCompatModule {}
