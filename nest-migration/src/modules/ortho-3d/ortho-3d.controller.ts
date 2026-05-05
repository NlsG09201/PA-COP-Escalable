import { BadRequestException, Controller, Get, NotFoundException, Param, Post, Query, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { TenancyInterceptor } from '../tenancy/tenancy.interceptor';
import { Ortho3dService } from './ortho-3d.service';

@ApiTags('ortho-3d')
@ApiBearerAuth()
@Controller('api/ortho/3d')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class Ortho3dController {
  constructor(private readonly service: Ortho3dService) {}

  @Post('reconstruct')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'files', maxCount: 10 },
    ]),
  )
  async reconstruct(
    @UploadedFiles() uploadedFiles: Record<string, any[]>,
    @Query('patientId') patientId: string,
    @Req() req: Request & { tenant: any },
  ) {
    const images: any[] = [
      ...(uploadedFiles?.file ?? []),
      ...(uploadedFiles?.files ?? []),
    ];

    if (images.length === 0) {
      throw new BadRequestException('Missing multipart images. Use field "file" or "files".');
    }

    const job = await this.service.createExternalJobAndPersist(patientId, images, req.tenant, req);

    return {
      jobId: job._id,
      status: job.status,
      externalJobId: job.externalJobId,
      glbUrl: job.glbPublicUrl ?? null,
      externalResultUrl: job.externalResultUrl ?? null,
      inputImageCount: job.inputImageCount ?? images.length,
    };
  }

  @Get('jobs/:jobId')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL')
  async poll(@Param('jobId') jobId: string, @Req() req: Request & { tenant: any }) {
    const job = await this.service.pollJobAndPersist(jobId, req.tenant, req);
    return {
      jobId: job._id,
      status: job.status,
      externalJobId: job.externalJobId,
      glbUrl: job.glbPublicUrl ?? null,
      errorMessage: job.errorMessage ?? null,
    };
  }

  @Get('jobs/:jobId/glb')
  @Roles('ADMIN', 'MEDICO', 'PROFESSIONAL')
  async downloadGlb(
    @Param('jobId') jobId: string,
    @Req() req: Request & { tenant: any },
    @Res() res: Response,
  ) {
    const filePath = await this.service.getGlbStoragePath(jobId, req.tenant);
    if (!filePath) {
      throw new NotFoundException('GLB not ready (or missing from local storage)');
    }

    // Let Express resolve headers; we only ensure it is streamed from disk.
    return res.sendFile(filePath, { headers: { 'Content-Type': 'model/gltf-binary' } });
  }
}

