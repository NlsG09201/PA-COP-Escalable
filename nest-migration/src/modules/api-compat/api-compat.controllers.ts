import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { ApiCompatService } from './api-compat.service';

/**
 * Compatibilidad Angular: datos desde Mongo cuando los microservicios AI no están en Render.
 */
@ApiTags('compat')
@ApiBearerAuth()
@Controller('api/diagnosis')
@UseGuards(JwtAuthGuard)
export class DiagnosisCompatController {
  constructor(private readonly compat: ApiCompatService) {}

  @Get('patients/:patientId/results')
  results(@Param('patientId') patientId: string) {
    return this.compat.diagnosisResultsForPatient(patientId);
  }
}

@Controller('api/budget')
@UseGuards(JwtAuthGuard)
export class BudgetCompatController {
  @Get('patients/:patientId')
  list() {
    return [];
  }
}

@Controller('api/followup')
@UseGuards(JwtAuthGuard)
export class FollowupCompatController {
  @Get('patients/:patientId/surveys')
  surveys() {
    return [];
  }

  @Get('patients/:patientId/schedules')
  schedules() {
    return [];
  }
}

@Controller('api/psychology')
@UseGuards(JwtAuthGuard)
export class PsychologyCompatController {
  @Get('patients/:patientId/evolution')
  evolution() {
    return [];
  }
}

@Controller('api/emotion')
@UseGuards(JwtAuthGuard)
export class EmotionCompatController {
  constructor(private readonly compat: ApiCompatService) {}

  @Get('patients/:patientId/results')
  results(@Param('patientId') patientId: string) {
    return this.compat.emotionResultsForPatient(patientId);
  }
}

@Controller('api/therapy')
@UseGuards(JwtAuthGuard)
export class TherapyCompatController {
  @Get('modules')
  modules() {
    return [];
  }

  @Get('patients/:patientId/progress')
  progress() {
    return {
      totalSessions: 0,
      avgScore: 0,
      sessionsByCategory: {} as Record<string, number>,
      streakDays: 0,
    };
  }

  @Get('patients/:patientId/sessions')
  sessions() {
    return [];
  }
}

@Controller('api/relapse')
@UseGuards(JwtAuthGuard)
export class RelapseCompatController {
  @Get('patients/:patientId/trend')
  trend() {
    return [];
  }

  @Get('patients/:patientId/risk')
  risk(@Param('patientId') patientId: string) {
    return {
      id: 'compat-stub',
      patientId,
      riskScore: 0,
      riskLevel: 'UNKNOWN',
      factors: [],
      actions: [],
      acknowledged: false,
      createdAt: new Date(0).toISOString(),
    };
  }
}

@Controller('api/psych-tests')
@UseGuards(JwtAuthGuard)
export class PsychTestsCompatController {
  @Get('templates')
  templates() {
    return [];
  }

  @Get('patients/:patientId/submissions')
  submissions() {
    return [];
  }
}

@Controller('api/copilot')
@UseGuards(JwtAuthGuard)
export class CopilotCompatController {
  @Get('patients/:patientId/history')
  history() {
    return [];
  }
}

@Controller('api/experience')
@UseGuards(JwtAuthGuard)
export class ExperienceCompatController {
  @Get('patients/:patientId')
  patient() {
    return { surveys: [], avgNps: 0 };
  }
}
