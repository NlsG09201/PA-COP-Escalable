import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { TenancyInterceptor } from '../tenancy/tenancy.interceptor';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClinicalService } from './clinical.service';

@ApiTags('clinical')
@ApiBearerAuth()
@Controller('api/clinical')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class ClinicalController {
  constructor(private readonly clinical: ClinicalService) {}

  @Get('records/:patientId')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL')
  async getRecords(@Param('patientId') patientId: string, @Request() req) {
    const record = await this.clinical.getOrCreateRecord(patientId, req.tenant);
    return { entries: record.entries ?? [] };
  }

  @Post('records/:patientId/entries')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL')
  async addEntry(
    @Param('patientId') patientId: string,
    @Body() body: { type: string; note: string },
    @Request() req,
  ) {
    await this.clinical.addEntry(patientId, body, req.tenant, req.user);
    return { ok: true };
  }
}
