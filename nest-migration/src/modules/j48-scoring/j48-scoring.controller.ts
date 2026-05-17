import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { J48ScoringService } from './j48-scoring.service';
import { ScorePatientDto } from './dto/score-patient.dto';
import { ScoreAllDto } from './dto/score-all.dto';

@ApiTags('j48')
@ApiBearerAuth()
@Controller('api/j48')
@UseGuards(JwtAuthGuard, RolesGuard)
export class J48ScoringController {
  constructor(private readonly scoring: J48ScoringService) {}

  private jwtUser(req: Request) {
    return req.user as { organization_id?: string; roles?: string[] };
  }

  @Post('score/all')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL', 'ORG_ADMIN', 'SITE_ADMIN', 'SUPER_ADMIN')
  scoreAll(@Req() req: Request, @Body() body: ScoreAllDto) {
    return this.scoring.scoreAllForUser(this.jwtUser(req), body);
  }

  @Post('score/patient')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL', 'ORG_ADMIN', 'SITE_ADMIN', 'SUPER_ADMIN')
  scorePatient(@Req() req: Request, @Body() body: ScorePatientDto) {
    return this.scoring.scorePatientForUser(body.patientId, this.jwtUser(req), body.organizationId).then((prediction) => ({
      ok: true,
      prediction,
    }));
  }

  @Get('analytics/class-distribution')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL', 'ORG_ADMIN', 'SITE_ADMIN', 'SUPER_ADMIN')
  classDistribution(@Req() req: Request, @Query('organizationId') organizationId?: string) {
    return this.scoring.classDistributionForUser(this.jwtUser(req), organizationId);
  }

  @Get('analytics/monthly')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL', 'ORG_ADMIN', 'SITE_ADMIN', 'SUPER_ADMIN')
  monthlyTrend(
    @Req() req: Request,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('organizationId') organizationId?: string,
  ) {
    if (!from?.trim() || !to?.trim()) {
      throw new BadRequestException('Parámetros from y to requeridos en formato ISO 8601');
    }
    return this.scoring.monthlyTrendForUser(this.jwtUser(req), from, to, organizationId);
  }

  @Get('analytics/count')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL', 'ORG_ADMIN', 'SITE_ADMIN', 'SUPER_ADMIN')
  predictionsCount(@Req() req: Request, @Query('organizationId') organizationId?: string) {
    return this.scoring.predictionsCountForUser(this.jwtUser(req), organizationId);
  }

  @Get('patients/:patientId/latest')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL', 'ORG_ADMIN', 'SITE_ADMIN', 'SUPER_ADMIN')
  latestForPatient(
    @Req() req: Request,
    @Param('patientId') patientId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.scoring.latestPredictionForPatient(patientId, this.jwtUser(req), organizationId);
  }

  @Get('patients/:patientId/history')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL', 'ORG_ADMIN', 'SITE_ADMIN', 'SUPER_ADMIN')
  historyForPatient(
    @Req() req: Request,
    @Param('patientId') patientId: string,
    @Query('limit') limit?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.scoring.predictionHistoryForPatient(patientId, this.jwtUser(req), {
      limit: limit ? Number(limit) : undefined,
      organizationId,
    });
  }
}
