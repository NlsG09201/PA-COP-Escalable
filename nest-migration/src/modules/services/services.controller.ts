import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { TenancyInterceptor } from '../tenancy/tenancy.interceptor';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth()
@Controller('api/services')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  @Get()
  @Roles('ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL')
  async list(@Req() req) {
    return this.service.list(req.tenant);
  }

  @Get('category/:category')
  @Roles('ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'MEDICO', 'PROFESSIONAL')
  async listByCategory(@Req() req, @Param('category') category: string) {
    return this.service.listByCategory(category, req.tenant);
  }

  @Post()
  @Roles('ADMIN', 'ORG_ADMIN')
  async create(@Req() req, @Body() body: any) {
    return this.service.create(body, req.tenant);
  }

  @Put(':id')
  @Roles('ADMIN', 'ORG_ADMIN')
  async update(@Req() req, @Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body, req.tenant);
  }

  @Put(':id/status')
  @Roles('ADMIN', 'ORG_ADMIN')
  async setStatus(@Req() req, @Param('id') id: string, @Body('active') active: boolean) {
    return this.service.setActive(id, Boolean(active), req.tenant);
  }

  @Delete(':id')
  @Roles('ADMIN', 'ORG_ADMIN')
  async remove(@Req() req, @Param('id') id: string) {
    return this.service.remove(id, req.tenant);
  }
}

