import { Controller, Get, Post, Body, Param, Patch, UseGuards, UseInterceptors, Req, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppointmentService } from './appointments.service';
import { AppointmentStatus } from './schemas/appointment.schema';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { TenancyInterceptor } from '../tenancy/tenancy.interceptor';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('api/appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class AppointmentController {
  constructor(private readonly service: AppointmentService) {}

  @Get()
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL')
  async list(
    @Req() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('professionalId') professionalId?: string,
    @Query('status') status?: AppointmentStatus,
  ) {
    return this.service.findPage(
      {
        from,
        to,
        page: page ? Number(page) : 0,
        size: size ? Number(size) : 50,
        professionalId,
        status,
      },
      req.tenant,
    );
  }

  @Post()
  @Roles('ADMIN', 'MEDICO', 'ORG_ADMIN')
  async create(@Body() dto: any, @Req() req) {
    return this.service.create(dto, req.tenant);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL')
  async updateStatus(@Param('id') id: string, @Body('status') status: AppointmentStatus, @Req() req) {
    return this.service.updateStatus(id, status, req.tenant);
  }
}
