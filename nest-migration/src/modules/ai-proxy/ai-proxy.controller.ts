import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { AiProxyService } from './ai-proxy.service';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiProxyController {
  constructor(private readonly ai: AiProxyService) {}

  /** diagnosis/emotion/therapy: ver ApiCompatModule (Mongo). Evita 503 a hosts Docker inexistentes en Render. */


  @Get('j48/model/tree')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL', 'PSICOLOGO')
  j48Tree() {
    return this.ai.j48Tree();
  }
}
