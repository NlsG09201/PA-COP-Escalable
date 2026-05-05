import { Controller, Post, Query, UseGuards, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { TenancyInterceptor } from '../tenancy/tenancy.interceptor';
import { OrthoXrayService } from './ortho-xray.service';

@ApiTags('ortho-xray')
@ApiBearerAuth()
@Controller('api/ortho/xray')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class OrthoXrayController {
  constructor(private readonly service: OrthoXrayService) {}

  @Post('reconstruct')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async reconstruct(@UploadedFile() file: any, @Query('patientId') patientId: string, @Req() req) {
    if (!patientId) {
      throw new Error('patientId is required');
    }
    if (!file) {
      throw new Error('file is required');
    }
    return this.service.reconstructAndPersist(patientId, file, req.tenant);
  }
}

