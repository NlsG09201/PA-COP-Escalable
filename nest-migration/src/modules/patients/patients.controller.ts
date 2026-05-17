import { Controller, Get, Post, Body, Query, UseGuards, UseInterceptors, Request } from '@nestjs/common';
import { PatientService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { ListPatientsQueryDto } from './dto/list-patients-query.dto';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { TenancyInterceptor } from '../tenancy/tenancy.interceptor';

@Controller('api/patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Get()
  @Roles('ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'SUPER_ADMIN')
  async list(@Request() req, @Query() query: ListPatientsQueryDto) {
    return this.patientService.findPage(req.tenant, query);
  }

  @Post()
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL')
  async create(@Body() createDto: CreatePatientDto, @Request() req) {
    return this.patientService.create(createDto, req.tenant);
  }
}
