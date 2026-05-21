import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WekaLabDataset } from './schemas/weka-lab-dataset.schema';
import { WekaLabModel } from './schemas/weka-lab-model.schema';
import { WekaLabPrediction } from './schemas/weka-lab-prediction.schema';
import { WekaLabAudit } from './schemas/weka-lab-audit.schema';
import { TenantContext } from '../tenancy/tenancy.interceptor';
import { TrainWekaModelDto } from './dto/train-weka-model.dto';
import { ClinicalPredictDto } from './dto/clinical-predict.dto';

@Injectable()
export class WekaLabService {
  private readonly logger = new Logger(WekaLabService.name);

  constructor(
    @InjectModel(WekaLabDataset.name) private readonly datasetModel: Model<WekaLabDataset>,
    @InjectModel(WekaLabModel.name) private readonly modelModel: Model<WekaLabModel>,
    @InjectModel(WekaLabPrediction.name) private readonly predictionModel: Model<WekaLabPrediction>,
    @InjectModel(WekaLabAudit.name) private readonly auditModel: Model<WekaLabAudit>,
  ) {}

  private j48Base(): string {
    const raw = process.env.J48_URL ?? 'http://j48-python:8080';
    return raw.replace(/\/predict\/?$/i, '').replace(/\/$/, '');
  }

  private async labJson<T>(path: string, init?: RequestInit): Promise<T | null> {
    const url = `${this.j48Base()}${path}`;
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(15_000),
        headers: {
          ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
          ...(init?.headers as Record<string, string>),
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`J48 lab ${path} → ${res.status}: ${text.slice(0, 200)}`);
        return null;
      }
      return res.json() as Promise<T>;
    } catch (err) {
      this.logger.warn(`J48 lab ${path} unreachable: ${(err as Error).message}`);
      return null;
    }
  }

  private requireLab<T>(remote: T | null, path: string): T {
    if (remote != null) return remote;
    throw new ServiceUnavailableException(
      'Servicio J48 Python no disponible. En Render configura J48_URL (cop-j48-python) y redeploy del API.',
    );
  }

  private async audit(
    tenant: TenantContext,
    userId: string | undefined,
    action: string,
    payload?: Record<string, unknown>,
    ip?: string,
  ) {
    await this.auditModel.create({
      organizationId: tenant.organizationId,
      userId,
      action,
      payload,
      ip,
    });
  }

  async listDatasets(tenant: TenantContext) {
    const rows = await this.datasetModel
      .find({ organizationId: tenant.organizationId })
      .sort({ created_at: -1 })
      .lean();
    if (rows.length) {
      return rows.map((r) => ({
        id: r.externalId,
        filename: r.filename,
        displayName: r.displayName,
        format: r.format,
        rows: r.rows,
        columns: r.columns,
        defaultTarget: r.defaultTarget,
        defaultFeatures: r.defaultFeatures,
        columnTypes: r.columnTypes,
        uploadedAt: (r as { created_at?: Date }).created_at,
      }));
    }
    const remote = await this.labJson<Array<Record<string, unknown>>>('/lab/datasets');
    return remote ?? [];
  }

  async uploadDataset(
    tenant: TenantContext,
    userId: string | undefined,
    file: { buffer: Buffer; originalname: string; mimetype?: string; size: number },
    displayName?: string,
    ip?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Archivo requerido');
    }
    const lower = (file.originalname ?? '').toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.arff')) {
      throw new BadRequestException('Solo CSV o ARFF');
    }
    if (file.size > 50 * 1024 * 1024) {
      throw new BadRequestException('Archivo mayor a 50MB');
    }

    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype || 'application/octet-stream',
    });
    form.append('file', blob, file.originalname);
    if (displayName) {
      form.append('displayName', displayName);
    }

    const meta = this.requireLab(
      await this.labJson<Record<string, unknown>>('/lab/datasets/upload', {
      method: 'POST',
      body: form,
      }),
      '/lab/datasets/upload',
    );

    await this.datasetModel.findOneAndUpdate(
      { externalId: String(meta.id) },
      {
        organizationId: tenant.organizationId,
        uploadedBy: userId,
        externalId: String(meta.id),
        filename: String(meta.filename ?? file.originalname),
        displayName: String(meta.displayName ?? displayName ?? file.originalname),
        format: String(meta.format ?? 'csv'),
        rows: Number(meta.rows ?? 0),
        columns: (meta.columns as string[]) ?? [],
        defaultTarget: meta.defaultTarget as string | undefined,
        defaultFeatures: (meta.defaultFeatures as string[]) ?? [],
        columnTypes: meta.columnTypes as Record<string, string> | undefined,
        meta,
      },
      { upsert: true, new: true },
    );

    await this.audit(tenant, userId, 'DATASET_UPLOAD', { datasetId: meta.id, filename: file.originalname }, ip);
    return meta;
  }

  async getDataset(tenant: TenantContext, datasetId: string) {
    const owned = await this.datasetModel.findOne({
      organizationId: tenant.organizationId,
      externalId: datasetId,
    });
    if (!owned && datasetId !== 'builtin-arff') {
      throw new BadRequestException('Dataset no encontrado en su organización');
    }
    return this.requireLab(
      await this.labJson<Record<string, unknown>>(`/lab/datasets/${encodeURIComponent(datasetId)}`),
      'dataset',
    );
  }

  async deleteDataset(tenant: TenantContext, userId: string | undefined, datasetId: string, ip?: string) {
    const del = await this.labJson<{ ok: boolean }>(`/lab/datasets/${encodeURIComponent(datasetId)}`, {
      method: 'DELETE',
    });
    if (del) {
      /* synced with remote */
    }
    await this.datasetModel.deleteOne({
      organizationId: tenant.organizationId,
      externalId: datasetId,
    });
    await this.audit(tenant, userId, 'DATASET_DELETE', { datasetId }, ip);
    return { ok: true };
  }

  async train(
    tenant: TenantContext,
    userId: string | undefined,
    dto: TrainWekaModelDto,
    ip?: string,
  ) {
    const meta = this.requireLab(
      await this.labJson<Record<string, unknown>>('/lab/train', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
      '/lab/train',
    );

    await this.modelModel.create({
      organizationId: tenant.organizationId,
      trainedBy: userId,
      externalId: String(meta.id),
      name: String(meta.name ?? 'J48'),
      version: String(meta.version ?? '1.0.0'),
      datasetId: meta.datasetId as string | undefined,
      featureColumns: (meta.featureColumns as string[]) ?? [],
      targetColumn: meta.targetColumn as string | undefined,
      hyperparameters: meta.hyperparameters as Record<string, unknown>,
      metrics: meta.metrics as Record<string, unknown>,
      engine: String(meta.engine ?? 'scikit-learn'),
      isActive: Boolean(meta.isActive),
      trainedAt: meta.trainedAt ? new Date(String(meta.trainedAt)) : new Date(),
    });

    if (meta.isActive) {
      await this.modelModel.updateMany(
        { organizationId: tenant.organizationId, externalId: { $ne: meta.id } },
        { $set: { isActive: false } },
      );
    }

    await this.audit(tenant, userId, 'MODEL_TRAIN', { modelId: meta.id, metrics: meta.metrics }, ip);
    return meta;
  }

  async listModels(tenant: TenantContext) {
    const rows = await this.modelModel
      .find({ organizationId: tenant.organizationId })
      .sort({ trainedAt: -1 })
      .lean();
    if (rows.length) {
      return rows.map((r) => ({
        id: r.externalId,
        name: r.name,
        version: r.version,
        datasetId: r.datasetId,
        featureColumns: r.featureColumns,
        targetColumn: r.targetColumn,
        hyperparameters: r.hyperparameters,
        metrics: r.metrics,
        engine: r.engine,
        isActive: r.isActive,
        trainedAt: r.trainedAt,
      }));
    }
    return (await this.labJson<Array<Record<string, unknown>>>('/lab/models')) ?? [];
  }

  async getModel(tenant: TenantContext, modelId: string) {
    const owned = await this.modelModel.findOne({
      organizationId: tenant.organizationId,
      externalId: modelId,
    });
    if (!owned) {
      throw new BadRequestException('Modelo no encontrado');
    }
    return this.requireLab(
      await this.labJson<Record<string, unknown>>(`/lab/models/${encodeURIComponent(modelId)}`),
      'model',
    );
  }

  async getModelTree(tenant: TenantContext, modelId: string) {
    await this.assertModelAccess(tenant, modelId);
    return this.requireLab(
      await this.labJson<Record<string, unknown>>(`/lab/models/${encodeURIComponent(modelId)}/tree`),
      'model tree',
    );
  }

  async activateModel(tenant: TenantContext, userId: string | undefined, modelId: string, ip?: string) {
    await this.assertModelAccess(tenant, modelId);
    const meta = this.requireLab(
      await this.labJson<Record<string, unknown>>(
        `/lab/models/${encodeURIComponent(modelId)}/activate`,
        { method: 'POST' },
      ),
      'activate',
    );
    await this.modelModel.updateMany(
      { organizationId: tenant.organizationId },
      { $set: { isActive: false } },
    );
    await this.modelModel.updateOne(
      { organizationId: tenant.organizationId, externalId: modelId },
      { $set: { isActive: true } },
    );
    await this.audit(tenant, userId, 'MODEL_ACTIVATE', { modelId }, ip);
    return meta;
  }

  async deleteModel(tenant: TenantContext, userId: string | undefined, modelId: string, ip?: string) {
    await this.assertModelAccess(tenant, modelId);
    await this.labJson<{ ok: boolean }>(`/lab/models/${encodeURIComponent(modelId)}`, {
      method: 'DELETE',
    });
    await this.modelModel.deleteOne({
      organizationId: tenant.organizationId,
      externalId: modelId,
    });
    await this.audit(tenant, userId, 'MODEL_DELETE', { modelId }, ip);
    return { ok: true };
  }

  async compareModels(tenant: TenantContext, modelIds: string[]) {
    for (const id of modelIds) {
      await this.assertModelAccess(tenant, id);
    }
    return this.labJson<Array<Record<string, unknown>>>('/lab/models/compare', {
      method: 'POST',
      body: JSON.stringify({ modelIds }),
    });
  }

  async predictClinical(
    tenant: TenantContext,
    userId: string | undefined,
    dto: ClinicalPredictDto,
    ip?: string,
  ) {
    if (dto.modelId) {
      await this.assertModelAccess(tenant, dto.modelId);
    }
    const result = this.requireLab(
      await this.labJson<Record<string, unknown>>('/lab/predict/clinical', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
      '/lab/predict/clinical',
    );

    await this.predictionModel.create({
      organizationId: tenant.organizationId,
      createdBy: userId,
      modelId: result.modelId as string | undefined,
      inputFeatures: result.featuresUsed as Record<string, unknown>,
      classLabel: result.classLabel as string | undefined,
      probabilities: result.probabilities as Record<string, number>,
      riskLevel: result.riskLevel as string | undefined,
      riskScore: result.riskScore as number | undefined,
      psychologicalScore: result.psychologicalScore as number | undefined,
      recommendations: (result.recommendations as string[]) ?? [],
    });

    await this.audit(tenant, userId, 'CLINICAL_PREDICT', { modelId: result.modelId, riskLevel: result.riskLevel }, ip);
    return result;
  }

  async dashboard(tenant: TenantContext) {
    const remote = await this.labJson<Record<string, unknown>>('/lab/dashboard');
    const orgModels = await this.modelModel.countDocuments({ organizationId: tenant.organizationId });
    const orgDatasets = await this.datasetModel.countDocuments({ organizationId: tenant.organizationId });
    const orgPredictions = await this.predictionModel.countDocuments({
      organizationId: tenant.organizationId,
    });
    const active = await this.modelModel.findOne({
      organizationId: tenant.organizationId,
      isActive: true,
    }).lean();

    const orgActiveModel = active
      ? { id: active.externalId, name: active.name, metrics: active.metrics }
      : remote?.activeModel;

    return {
      ...(remote ?? {}),
      organizationId: tenant.organizationId,
      orgModelsCount: orgModels,
      orgDatasetsCount: orgDatasets,
      orgPredictionsCount: orgPredictions,
      orgActiveModel,
      j48LabOnline: remote != null,
      message:
        remote == null
          ? 'J48 Python no responde; se muestran contadores guardados en MongoDB. Configura J48_URL en Render.'
          : undefined,
    };
  }

  async predictionHistory(tenant: TenantContext, limit = 50) {
    const rows = await this.predictionModel
      .find({ organizationId: tenant.organizationId })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();
    return rows;
  }

  private async assertModelAccess(tenant: TenantContext, modelId: string) {
    const owned = await this.modelModel.exists({
      organizationId: tenant.organizationId,
      externalId: modelId,
    });
    if (!owned) {
      throw new BadRequestException('Modelo no pertenece a su organización');
    }
  }
}
