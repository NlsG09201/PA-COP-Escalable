import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../iam/guards/jwt-auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/decorators/roles.decorator';
import { TenancyInterceptor, TenantContext } from '../tenancy/tenancy.interceptor';
import { WekaLabService } from './weka-lab.service';
import { TrainWekaModelDto } from './dto/train-weka-model.dto';
import { ClinicalPredictDto } from './dto/clinical-predict.dto';
import { CompareModelsDto } from './dto/compare-models.dto';

const LAB_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'ORG_ADMIN',
  'SITE_ADMIN',
  'MEDICO',
  'PROFESSIONAL',
  'PSICOLOGO',
] as const;

@ApiTags('weka-lab')
@ApiBearerAuth()
@Controller('api/weka-lab')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenancyInterceptor)
export class WekaLabController {
  constructor(private readonly wekaLab: WekaLabService) {}

  @Get('dashboard')
  @Roles(...LAB_ROLES)
  dashboard(@Req() req: { tenant: TenantContext }) {
    return this.wekaLab.dashboard(req.tenant);
  }

  @Get('datasets')
  @Roles(...LAB_ROLES)
  listDatasets(@Req() req: { tenant: TenantContext }) {
    return this.wekaLab.listDatasets(req.tenant);
  }

  @Get('dataset-schema')
  @Roles(...LAB_ROLES)
  datasetSchema() {
    return this.wekaLab.datasetSchema();
  }

  @Post('datasets/upload')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'PSICOLOGO')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadDataset(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype?: string; size: number },
    @Query('displayName') displayName: string | undefined,
    @Req() req: { tenant: TenantContext; user: { userId?: string }; ip?: string },
  ) {
    return this.wekaLab.uploadDataset(req.tenant, req.user?.userId, file, displayName, req.ip);
  }

  @Get('datasets/:id')
  @Roles(...LAB_ROLES)
  getDataset(@Param('id') id: string, @Req() req: { tenant: TenantContext }) {
    return this.wekaLab.getDataset(req.tenant, id);
  }

  @Delete('datasets/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN')
  deleteDataset(
    @Param('id') id: string,
    @Req() req: { tenant: TenantContext; user: { userId?: string }; ip?: string },
  ) {
    return this.wekaLab.deleteDataset(req.tenant, req.user?.userId, id, req.ip);
  }

  @Post('train')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'PSICOLOGO')
  train(
    @Body() dto: TrainWekaModelDto,
    @Req() req: { tenant: TenantContext; user: { userId?: string }; ip?: string },
  ) {
    return this.wekaLab.train(req.tenant, req.user?.userId, dto, req.ip);
  }

  @Get('models')
  @Roles(...LAB_ROLES)
  listModels(@Req() req: { tenant: TenantContext }) {
    return this.wekaLab.listModels(req.tenant);
  }

  @Get('models/:id')
  @Roles(...LAB_ROLES)
  getModel(@Param('id') id: string, @Req() req: { tenant: TenantContext }) {
    return this.wekaLab.getModel(req.tenant, id);
  }

  @Get('models/:id/tree')
  @Roles(...LAB_ROLES)
  modelTree(@Param('id') id: string, @Req() req: { tenant: TenantContext }) {
    return this.wekaLab.getModelTree(req.tenant, id);
  }

  @Post('models/:id/activate')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'PSICOLOGO')
  activateModel(
    @Param('id') id: string,
    @Req() req: { tenant: TenantContext; user: { userId?: string }; ip?: string },
  ) {
    return this.wekaLab.activateModel(req.tenant, req.user?.userId, id, req.ip);
  }

  @Delete('models/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN')
  deleteModel(
    @Param('id') id: string,
    @Req() req: { tenant: TenantContext; user: { userId?: string }; ip?: string },
  ) {
    return this.wekaLab.deleteModel(req.tenant, req.user?.userId, id, req.ip);
  }

  @Post('models/compare')
  @Roles(...LAB_ROLES)
  compareModels(@Body() dto: CompareModelsDto, @Req() req: { tenant: TenantContext }) {
    return this.wekaLab.compareModels(req.tenant, dto.modelIds);
  }

  @Post('predict/clinical')
  @Roles(...LAB_ROLES)
  predictClinical(
    @Body() dto: ClinicalPredictDto,
    @Req() req: { tenant: TenantContext; user: { userId?: string }; ip?: string },
  ) {
    return this.wekaLab.predictClinical(req.tenant, req.user?.userId, dto, req.ip);
  }

  @Get('predictions/history')
  @Roles(...LAB_ROLES)
  predictionHistory(
    @Query('limit') limit: string | undefined,
    @Req() req: { tenant: TenantContext },
  ) {
    const n = Math.min(200, Math.max(1, parseInt(limit ?? '50', 10) || 50));
    return this.wekaLab.predictionHistory(req.tenant, n);
  }
}
