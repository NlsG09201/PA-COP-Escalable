import { Controller, Get, Post, Body, UseGuards, UseInterceptors, Request } from '@nestjs/common';
import { PatientService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
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
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL')
  async list(@Request() req) {
    return this.patientService.findAll(req.tenant);
  }

  @Post()
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL')
  async create(@Body() createDto: CreatePatientDto, @Request() req) {
    return this.patientService.create(createDto, req.tenant);
  }
}
