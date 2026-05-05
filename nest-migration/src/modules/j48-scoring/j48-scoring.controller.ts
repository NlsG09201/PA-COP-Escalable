import { Body, Controller, Post } from '@nestjs/common';
import { J48ScoringService } from './j48-scoring.service';

@Controller('api/j48')
export class J48ScoringController {
  constructor(private readonly scoring: J48ScoringService) {}

  @Post('score/all')
  async scoreAll() {
    return this.scoring.scoreAllPatients();
  }

  @Post('score/patient')
  async scorePatient(@Body() body: { patientId: string; organizationId?: string; siteId?: string }) {
    if (!body?.patientId) {
      throw new Error('patientId is required');
    }
    const doc = await this.scoring.scorePatient(body.patientId, body.organizationId, body.siteId);
    return { ok: true, prediction: doc };
  }
}

