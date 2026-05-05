import { Controller, Get, Patch, Body, Param, UseGuards, UseInterceptors, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OdontogramService } from './odontogram.service';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { TenancyInterceptor } from '../tenancy/tenancy.interceptor';

@ApiTags('odontogram')
@ApiBearerAuth()
@Controller('api/odontogram')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class OdontogramController {
  constructor(private readonly service: OdontogramService) {}

  @Get(':patientId')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL')
  async getByPatient(@Param('patientId') patientId: string, @Req() req) {
    return this.service.getOrCreate(patientId, req.tenant);
  }

  @Patch(':patientId')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL')
  async patch(@Param('patientId') patientId: string, @Body() body: any, @Req() req) {
    return this.service.patch(patientId, body, req.tenant);
  }
}
