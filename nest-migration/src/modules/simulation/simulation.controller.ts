import { Controller, Get, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { TenancyInterceptor } from '../tenancy/tenancy.interceptor';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('simulation')
@ApiBearerAuth()
@Controller('api/simulation')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  /** Lists simulations for a patient (legacy Spring path). Not yet wired to persistence. */
  @Get('patients/:patientId')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL')
  async listByPatient(@Param('patientId') _patientId: string) {
    return [];
  }

  @Get(':id')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL')
  async getSimulation(@Param('id') id: string) {
    return this.simulationService.getSimulationResult(id);
  }
}
