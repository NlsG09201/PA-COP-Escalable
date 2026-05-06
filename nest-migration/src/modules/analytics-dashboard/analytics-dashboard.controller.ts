import { Controller, Get, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { TenancyInterceptor } from '../tenancy/tenancy.interceptor';
import { AnalyticsDashboardService, GroupBy } from './analytics-dashboard.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('api/analytics/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class AnalyticsDashboardController {
  constructor(private readonly service: AnalyticsDashboardService) {}

  @Get('kpis')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL', 'ORG_ADMIN', 'SITE_ADMIN')
  async kpis(@Req() req, @Query('from') from: string, @Query('to') to: string) {
    return this.service.kpis({ from, to }, req.tenant);
  }

  @Get('appointments/trend')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL', 'ORG_ADMIN', 'SITE_ADMIN')
  async appointmentsTrend(
    @Req() req,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('groupBy') groupBy: GroupBy,
  ) {
    return this.service.appointmentsTrend({ from, to, groupBy }, req.tenant);
  }

  @Get('revenue/trend')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL', 'ORG_ADMIN', 'SITE_ADMIN')
  async revenueTrend(
    @Req() req,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('groupBy') groupBy: GroupBy,
  ) {
    return this.service.revenueTrend({ from, to, groupBy }, req.tenant);
  }

  @Get('specialties/distribution')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL', 'ORG_ADMIN', 'SITE_ADMIN')
  async specialtiesDistribution(@Req() req, @Query('from') from: string, @Query('to') to: string) {
    return this.service.specialtiesDistribution({ from, to }, req.tenant);
  }

  @Get('doctors/performance')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL', 'ORG_ADMIN', 'SITE_ADMIN')
  async doctorsPerformance(
    @Req() req,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.doctorsPerformance({ from, to, limit: limit ? Number(limit) : 10 }, req.tenant);
  }

  @Get('appointments/heatmap')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL', 'ORG_ADMIN', 'SITE_ADMIN')
  async appointmentsHeatmap(@Req() req, @Query('from') from: string, @Query('to') to: string) {
    return this.service.appointmentsHeatmap({ from, to }, req.tenant);
  }
}

