import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import { OdontogramService } from '../odontogram/odontogram.service';
import { TenantContext } from '../tenancy/tenancy.interceptor';
import { Ortho3dJob, Ortho3dJobStatus } from './schemas/ortho-3d-job.schema';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';

type ReconstructResponse = {
  status: string;
  data: Array<{
    id?: string;
    fdi?: string;
    confidence?: number;
    pos_3d?: { x: number; y: number; z: number };
    rotation?: { x?: number; y?: number; z?: number };
    dimensions?: { w?: number; h?: number; d?: number };
  }>;
};

const UPPER_FDI = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_FDI = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

@Injectable()
export class Ortho3dService {
  private readonly orthoBaseUrl: string;

  private readonly externalBaseUrl: string;
  private readonly createPath: string;
  private readonly pollPathTemplate: string;
  private readonly inputImageField: string;
  private readonly inputImagesField: string;

  private readonly dicomBaseUrl: string;
  private readonly dicomCreatePath: string;
  private readonly dicomPollPathTemplate: string;

  private readonly downloadResults: boolean;
  private readonly storageDir: string;
  private readonly publicBaseUrlOverride?: string;
  /** Si está definido (0–1), se descartan piezas con `confidence` por debajo antes de generar poses. */
  private readonly reconstructMinConfidence?: number;

  constructor(
    config: ConfigService,
    @InjectModel(Ortho3dJob.name) private jobModel: Model<Ortho3dJob>,
    private readonly odontogram: OdontogramService,
  ) {
    this.orthoBaseUrl = config.get<string>('ORTHO_AI_URL') ?? 'http://ortho-ai:8000';

    this.externalBaseUrl = config.get<string>('ORTHO_IMAGE_TO_3D_BASE_URL') ?? 'http://image-to-3d:8000';
    this.createPath = config.get<string>('ORTHO_IMAGE_TO_3D_CREATE_PATH') ?? '/openapi/v1/image-to-3d';
    this.pollPathTemplate =
      config.get<string>('ORTHO_IMAGE_TO_3D_POLL_PATH_TEMPLATE') ?? '/openapi/v1/image-to-3d/{id}';
    this.inputImageField = config.get<string>('ORTHO_IMAGE_TO_3D_INPUT_IMAGE_FIELD') ?? 'image_url';
    this.inputImagesField = config.get<string>('ORTHO_IMAGE_TO_3D_INPUT_IMAGES_FIELD') ?? 'images';

    this.dicomBaseUrl = config.get<string>('ORTHO_DICOM_TO_3D_BASE_URL') ?? 'http://dicom-to-glb:8000';
    this.dicomCreatePath = config.get<string>('ORTHO_DICOM_TO_3D_CREATE_PATH') ?? '/openapi/v1/dicom-to-3d';
    this.dicomPollPathTemplate =
      config.get<string>('ORTHO_DICOM_TO_3D_POLL_PATH_TEMPLATE') ?? '/openapi/v1/dicom-to-3d/{id}';

    this.downloadResults = (config.get<string>('ORTHO_3D_DOWNLOAD_RESULTS') ?? 'true') !== 'false';
    this.storageDir = path.resolve(config.get<string>('ORTHO_3D_STORAGE_DIR') ?? './uploads/ortho-3d');
    this.publicBaseUrlOverride = config.get<string>('ORTHO_3D_PUBLIC_BASE_URL') ?? undefined;

    const confRaw = config.get<string>('ORTHO_RECONSTRUCT_MIN_CONFIDENCE');
    if (confRaw != null && String(confRaw).trim() !== '') {
      const n = Number(confRaw);
      if (!Number.isNaN(n) && n >= 0 && n <= 1) {
        this.reconstructMinConfidence = n;
      }
    }
  }

  async createExternalJobAndPersist(
    patientId: string,
    images: any[],
    tenant: TenantContext,
    req: any,
  ): Promise<Ortho3dJob> {
    if (!patientId) throw new BadRequestException('patientId is required');
    if (!Array.isArray(images) || images.length === 0) throw new BadRequestException('at least 1 image is required');

    // 1) Always keep the existing parametric fallback available in odontogram.
    //    This ensures the UX keeps working even if the external Image→3D API is slow/unavailable.
    try {
      const fallbackSimulation = await this.buildFallbackSimulationFromLocalAi(images[0]);
      await this.odontogram.patch(patientId, { simulation: fallbackSimulation }, tenant);
    } catch (err) {
      // Fallback is best-effort: external 3D should still be able to run.
      // eslint-disable-next-line no-console
      console.warn('[ortho-3d] local fallback simulation failed:', err);
    }

    // 2) Create an external async job (Meshy / Tripo / stub / etc.).
    let externalJobId: string;
    let externalResultUrl: string | undefined;
    let initialStatus: string | undefined;
    try {
      const ext = await this.callExternalCreate(images);
      externalJobId = ext.externalJobId;
      externalResultUrl = ext.externalResultUrl;
      initialStatus = ext.initialStatus;
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn('[ortho-3d] external Image→3D create failed:', err);
      const job = new this.jobModel({
        organizationId: tenant.organizationId,
        siteId: tenant.siteId ?? null,
        patientId,
        externalJobId: `unavailable-${randomUUID()}`,
        status: 'FAILED',
        errorMessage: String(err?.message ?? err ?? 'Image→3D create failed'),
        inputImageCount: images.length,
      });
      await job.save();
      return this.jobModel.findById(job._id).exec();
    }

    const job = new this.jobModel({
      organizationId: tenant.organizationId,
      siteId: tenant.siteId ?? null,
      patientId,
      externalJobId,
      status: this.mapExternalStatusToJobStatus(initialStatus),
      externalResultUrl: externalResultUrl ?? undefined,
      inputImageCount: images.length,
    });

    await job.save();

    // If the provider already returned a result, persist it immediately.
    if (externalResultUrl && this.isJobSucceededStatus(job.status)) {
      if (this.downloadResults) {
        await this.tryDownloadAndStoreGlb(job, externalResultUrl, req);
      } else {
        // “Storage” mode as URL persistence: keep the provider URL.
        job.glbPublicUrl = externalResultUrl;
      }
      await job.save();
    }

    const saved = await this.jobModel.findById(job._id).exec();
    if (saved?.glbPublicUrl) {
      await this.syncPatientSimulationGlb(saved, tenant);
    }
    return saved;
  }

  async createDicomJobAndPersist(
    patientId: string,
    dicomZip: any,
    tenant: TenantContext,
    req: any,
  ): Promise<Ortho3dJob> {
    if (!patientId) throw new BadRequestException('patientId is required');
    if (!dicomZip?.buffer) throw new BadRequestException('DICOM ZIP is required');

    const job = new this.jobModel({
      organizationId: tenant.organizationId,
      siteId: tenant.siteId ?? null,
      patientId,
      externalJobId: `dicom-${randomUUID()}`,
      status: 'PROCESSING',
      inputImageCount: 0,
    });
    await job.save();

    try {
      const ext = await this.callDicomCreate(dicomZip);
      job.status = this.mapExternalStatusToJobStatus(ext.initialStatus);
      job.externalResultUrl = ext.externalResultUrl ?? undefined;
      if (ext.externalResultUrl && this.isJobSucceededStatus(job.status)) {
        if (this.downloadResults) {
          await this.tryDownloadAndStoreGlb(job, ext.externalResultUrl, req);
        } else {
          job.glbPublicUrl = ext.externalResultUrl;
        }
      }
      await job.save();
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn('[ortho-3d] dicom-to-glb failed:', err);
      job.status = 'FAILED';
      job.errorMessage = String(err?.message ?? err ?? 'DICOM→GLB failed');
      await job.save();
    }

    const fresh = await this.jobModel.findById(job._id).exec();
    if (fresh?.glbPublicUrl && fresh.status === 'SUCCEEDED') {
      await this.syncPatientSimulationGlb(fresh, tenant);
    }
    return fresh ?? job;
  }

  async pollJobAndPersist(
    jobId: string,
    tenant: TenantContext,
    req: any,
  ): Promise<Ortho3dJob> {
    const job = await this.findTenantJob(jobId, tenant);
    if (!job) throw new InternalServerErrorException('Unexpected job resolution failure');

    if (job.status === 'SUCCEEDED' || job.status === 'FAILED') {
      return job;
    }

    const poll = await this.callExternalPoll(job.externalJobId);
    const status = this.mapExternalStatusToJobStatus(poll.status ?? poll.state, poll);
    job.status = status;
    if (poll.externalResultUrl) job.externalResultUrl = poll.externalResultUrl;
    if (poll.externalError) job.errorMessage = poll.externalError;

    if (status === 'SUCCEEDED' && poll.externalResultUrl) {
      if (this.downloadResults) {
        await this.tryDownloadAndStoreGlb(job, poll.externalResultUrl, req);
      } else {
        job.glbPublicUrl = poll.externalResultUrl;
      }
    }

    await job.save();
    const fresh = await this.jobModel.findById(job._id).exec();
    if (fresh?.glbPublicUrl && fresh.status === 'SUCCEEDED') {
      await this.syncPatientSimulationGlb(fresh, tenant);
    }
    return fresh ?? job;
  }

  /** Writes `glbUrl` into the patient odontogram so the Angular viewer loads the mesh after reload. */
  private async syncPatientSimulationGlb(job: Ortho3dJob, tenant: TenantContext): Promise<void> {
    if (!job.patientId || !job.glbPublicUrl) return;

    const o = await this.odontogram.getOrCreate(job.patientId, tenant);
    const prev =
      o.orthoSimulation && typeof o.orthoSimulation === 'object' ? { ...(o.orthoSimulation as object) } : {};
    const prevMeta =
      prev &&
      typeof (prev as any).reconstructionMeta === 'object' &&
      (prev as any).reconstructionMeta !== null
        ? { ...(prev as any).reconstructionMeta }
        : {};

    o.orthoSimulation = {
      ...prev,
      glbUrl: job.glbPublicUrl,
      reconstructionMeta: {
        ...prevMeta,
        source: 'image-to-3d-external',
        jobId: String(job._id),
        externalJobId: job.externalJobId,
      },
    };
    o.updatedAt = new Date();
    await o.save();
  }

  async getGlbStoragePath(jobId: string, tenant: TenantContext): Promise<string | null> {
    const job = await this.findTenantJob(jobId, tenant);
    if (!job) return null;
    if (!job.glbStoragePath) return null;

    // Validate file exists (storage may be cleaned between deploys).
    try {
      await fs.access(job.glbStoragePath);
      return job.glbStoragePath;
    } catch {
      return null;
    }
  }

  private async findTenantJob(jobId: string, tenant: TenantContext): Promise<Ortho3dJob | null> {
    const org = String(tenant.organizationId ?? '');
    const site = tenant.siteId != null && String(tenant.siteId).trim() !== '' ? String(tenant.siteId) : null;

    // Jobs may be stored with siteId null (token sin sitio) mientras el JWT actual incluye site_id, o al revés.
    // Restringimos por organización y aceptamos jobs "org-wide" (sin sitio) además del sitio explícito.
    const base: Record<string, unknown> = { _id: jobId, organizationId: org };
    if (site) {
      return this.jobModel
        .findOne({
          ...base,
          $or: [{ siteId: site }, { siteId: null }, { siteId: { $exists: false } }],
        } as any)
        .exec();
    }
    return this.jobModel
      .findOne({
        ...base,
        $or: [{ siteId: null }, { siteId: { $exists: false } }],
      } as any)
      .exec();
  }

  private mapExternalStatusToJobStatus(
    externalStatus?: unknown,
    pollPayload?: any,
  ): Ortho3dJobStatus {
    const s = String(externalStatus ?? pollPayload?.status ?? pollPayload?.state ?? '').toLowerCase();
    if (s.includes('fail') || s.includes('error')) return 'FAILED';
    if (s.includes('succeed') || s.includes('done') || s.includes('complete')) return 'SUCCEEDED';
    if (pollPayload?.externalResultUrl) return 'SUCCEEDED';
    if (s.includes('processing') || s.includes('running') || s.includes('pending') || s.includes('queued')) return 'PROCESSING';
    return 'PROCESSING';
  }

  private isJobSucceededStatus(status: Ortho3dJobStatus): boolean {
    return status === 'SUCCEEDED';
  }

  private buildGlbPublicUrl(jobId: string, req: any): string {
    const base = this.publicBaseUrlOverride?.replace(/\/$/, '');
    if (base) {
      return `${base}/api/ortho/3d/jobs/${jobId}/glb`;
    }
    const forwardedHost = req?.get?.('x-forwarded-host');
    const host = forwardedHost || req?.get?.('host');
    const rawProto = req?.get?.('x-forwarded-proto') ?? req?.protocol ?? 'http';
    const proto = String(rawProto).split(',')[0].trim() || 'http';
    return `${proto}://${host}/api/ortho/3d/jobs/${jobId}/glb`;
  }

  private async ensureStorageDir(): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true });
  }

  private async tryDownloadAndStoreGlb(job: Ortho3dJob, externalResultUrl: string, req: any): Promise<void> {
    await this.ensureStorageDir();

    const urlOrData = String(externalResultUrl);
    // TODO: if the provider returns OBJ, extend to multiple formats.
    const filePath = path.join(this.storageDir, `${job._id}.glb`);

    const buf = await this.fetchBinaryFromUrlOrDataUri(urlOrData);
    await fs.writeFile(filePath, buf);

    job.glbStoragePath = filePath;
    job.glbPublicUrl = this.buildGlbPublicUrl(job._id, req);
  }

  private async fetchBinaryFromUrlOrDataUri(urlOrData: string): Promise<Buffer> {
    if (urlOrData.startsWith('data:')) {
      const comma = urlOrData.indexOf(',');
      if (comma < 0) throw new BadRequestException('Invalid data URI');
      const b64 = urlOrData.slice(comma + 1);
      return Buffer.from(b64, 'base64');
    }

    const res = await fetch(urlOrData);
    if (!res.ok) {
      throw new InternalServerErrorException(`Failed to download model (${res.status})`);
    }
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  }

  private async callLocalReconstruct(image: any): Promise<ReconstructResponse> {
    const url = `${this.orthoBaseUrl}/api/reconstruct`;
    const fd = new FormData();
    fd.append('file', new Blob([image.buffer]), image.originalname);
    const res = await fetch(url, { method: 'POST', body: fd });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new InternalServerErrorException(`ortho-ai reconstruct failed (${res.status}): ${text}`);
    }
    return (await res.json()) as ReconstructResponse;
  }

  private async buildFallbackSimulationFromLocalAi(image: any): Promise<any> {
    const reconstructed = await this.callLocalReconstruct(image);
    const raw = reconstructed?.data ?? [];
    const filtered = this.filterRawTeethByConfidence(raw);
    const poses = this.toToothPoses(filtered);
    const confVals = raw
      .map((t) => t.confidence)
      .filter((c): c is number => typeof c === 'number' && !Number.isNaN(c));
    const meanConfidence = confVals.length ? confVals.reduce((a, b) => a + b, 0) / confVals.length : null;
    const minConfidence = confVals.length ? Math.min(...confVals) : null;
    return {
      plannedDurationMonths: 18,
      notes: 'Reconstrucción paramétrica desde imagen intraoral (fallback ortho-ai)',
      reconstructionMeta: {
        source: 'ortho-ai-local',
        teethDetected: raw.length,
        teethPosed: Object.keys(poses).length,
        meanConfidence,
        minConfidence,
        excludedBelowThreshold: raw.length - filtered.length,
        confidenceThreshold:
          this.reconstructMinConfidence !== undefined ? this.reconstructMinConfidence : null,
      },
      keyframes: [
        { t: 0, toothPoses: poses },
        { t: 1, toothPoses: poses },
      ],
    };
  }

  private filterRawTeethByConfidence(raw: ReconstructResponse['data']): ReconstructResponse['data'] {
    if (this.reconstructMinConfidence === undefined) return raw;
    const t = this.reconstructMinConfidence;
    return raw.filter((x) => (x.confidence ?? 1) >= t);
  }

  private toToothPoses(raw: ReconstructResponse['data']): Record<string, any> {
    if (!Array.isArray(raw) || raw.length === 0) return {};

    // Split upper/lower using median y.
    const ys = raw.map((t) => t.pos_3d?.y ?? 0).sort((a, b) => a - b);
    const medianY = ys[Math.floor(ys.length / 2)] ?? 0;
    const upper = raw.filter((t) => (t.pos_3d?.y ?? 0) <= medianY);
    const lower = raw.filter((t) => (t.pos_3d?.y ?? 0) > medianY);

    const mapRow = (teeth: typeof raw, fdiSeq: string[]) => {
      const sorted = [...teeth].sort((a, b) => (a.pos_3d?.x ?? 0) - (b.pos_3d?.x ?? 0));
      // If fewer than 16 detections, center them in the arch.
      const start = Math.max(0, Math.floor((fdiSeq.length - sorted.length) / 2));
      const slice = fdiSeq.slice(start, start + sorted.length);
      return Object.fromEntries(
        sorted.map((t, idx) => {
          const fdi = (t.fdi && String(t.fdi).length === 2 ? String(t.fdi) : slice[idx]) ?? slice[idx] ?? String(t.id ?? `t${idx}`);
          const p = t.pos_3d ?? { x: 0, y: 0, z: 0 };
          const r = t.rotation ?? {};
          const conf = t.confidence;
          const pose: Record<string, number> = {
            rotX: Number(r.x ?? 0),
            rotY: Number(r.y ?? 0),
            rotZ: Number(r.z ?? 0),
            offsetMmX: Number(p.x ?? 0),
            offsetMmY: Number(p.y ?? 0),
            offsetMmZ: Number(p.z ?? 0),
          };
          if (typeof conf === 'number' && !Number.isNaN(conf)) {
            pose.confidence = Math.max(0, Math.min(1, conf));
          }
          return [fdi, pose];
        }),
      );
    };

    return { ...mapRow(upper, UPPER_FDI), ...mapRow(lower, LOWER_FDI) };
  }

  private async callExternalCreate(
    images: any[],
  ): Promise<{ externalJobId: string; externalResultUrl?: string; initialStatus?: string }> {
    // Prevent accidental usage of the dev stub (it returns a demo duck GLB).
    // Real photo→3D requires a real provider configured via ORTHO_IMAGE_TO_3D_*.
    const allowStub = String(process.env.ORTHO_IMAGE_TO_3D_ALLOW_STUB_DEMO ?? '')
      .trim()
      .toLowerCase() === 'true';
    const pointsToStub = this.externalBaseUrl.includes('image-to-3d') || this.externalBaseUrl.includes('8010');
    if (!allowStub && pointsToStub) {
      throw new BadRequestException(
        'Fotos→3D está en modo demo (stub). Para un modelo real del paciente usa CBCT/DICOM (ZIP) o configura un proveedor externo.',
      );
    }

    const url = `${this.externalBaseUrl}${this.createPath}`;

    const dataUris = images.map((img) => {
      const mime = img.mimetype || 'image/jpeg';
      const b64 = img.buffer.toString('base64');
      return `data:${mime};base64,${b64}`;
    });

    // Most public “image-to-3d” APIs accept either a single image data URI or an array.
    const body: any = {};
    body[this.inputImageField] = dataUris.length === 1 ? dataUris[0] : dataUris[0];
    body[this.inputImagesField] = dataUris;

    const apiKey = process.env.ORTHO_IMAGE_TO_3D_API_KEY;
    const apiKeyHeader = process.env.ORTHO_IMAGE_TO_3D_API_KEY_HEADER ?? 'Authorization';
    const apiKeyPrefix = process.env.ORTHO_IMAGE_TO_3D_API_KEY_PREFIX ?? 'Bearer ';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers[apiKeyHeader] = `${apiKeyPrefix}${apiKey}`;

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new InternalServerErrorException(`Image→3D create failed (${res.status}): ${text}`);
    }

    const payload = (await res.json()) as any;
    const externalJobId =
      payload?.jobId ??
      payload?.task_id ??
      payload?.taskId ??
      payload?.id ??
      payload?.externalJobId ??
      payload?.job_id;

    if (!externalJobId) {
      throw new InternalServerErrorException(`Image→3D create response missing job id: ${JSON.stringify(payload).slice(0, 300)}`);
    }

    const externalResultUrl =
      payload?.glb_url ??
      payload?.glbUrl ??
      payload?.result_url ??
      payload?.resultUrl ??
      payload?.output?.glb_url ??
      payload?.output?.result_url ??
      payload?.output?.glbUrl;

    const initialStatus = payload?.status ?? payload?.state ?? payload?.phase;

    // If we got a result URL immediately, treat it as succeeded.
    const initialHasResult = typeof externalResultUrl === 'string' && externalResultUrl.length > 0;
    return {
      externalJobId: String(externalJobId),
      externalResultUrl: initialHasResult ? String(externalResultUrl) : undefined,
      initialStatus: initialHasResult ? 'SUCCEEDED' : initialStatus,
    };
  }

  private async callDicomCreate(
    dicomZip: any,
  ): Promise<{ externalJobId: string; externalResultUrl?: string; initialStatus?: string }> {
    const url = `${this.dicomBaseUrl}${this.dicomCreatePath}`;
    const fd = new FormData();
    fd.append('file', new Blob([dicomZip.buffer]), dicomZip.originalname ?? 'dicom.zip');

    const apiKey = process.env.ORTHO_DICOM_TO_3D_API_KEY;
    const apiKeyHeader = process.env.ORTHO_DICOM_TO_3D_API_KEY_HEADER ?? 'Authorization';
    const apiKeyPrefix = process.env.ORTHO_DICOM_TO_3D_API_KEY_PREFIX ?? 'Bearer ';
    const headers: Record<string, string> = {};
    if (apiKey) headers[apiKeyHeader] = `${apiKeyPrefix}${apiKey}`;

    const res = await fetch(url, { method: 'POST', headers, body: fd as any });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new InternalServerErrorException(`DICOM→3D create failed (${res.status}): ${text}`);
    }
    const payload = (await res.json()) as any;
    const externalJobId = payload?.jobId ?? payload?.id;
    const externalResultUrl =
      payload?.glb_url ?? payload?.glbUrl ?? payload?.result_url ?? payload?.resultUrl;
    const initialStatus = payload?.status ?? payload?.state ?? payload?.phase ?? 'SUCCEEDED';
    if (!externalJobId) {
      throw new InternalServerErrorException(
        `DICOM→3D create response missing job id: ${JSON.stringify(payload).slice(0, 300)}`,
      );
    }
    // The service returns a relative file URL; make it absolute.
    const absolute =
      typeof externalResultUrl === 'string' && externalResultUrl.startsWith('http')
        ? externalResultUrl
        : typeof externalResultUrl === 'string'
          ? `${this.dicomBaseUrl}${externalResultUrl}`
          : undefined;

    return {
      externalJobId: String(externalJobId),
      externalResultUrl: absolute,
      initialStatus: absolute ? 'SUCCEEDED' : initialStatus,
    };
  }

  private async callExternalPoll(externalJobId: string): Promise<{
    status?: string;
    state?: string;
    externalResultUrl?: string;
    externalError?: string;
  }> {
    const pollPath = this.pollPathTemplate.replace('{id}', encodeURIComponent(externalJobId));
    const url = `${this.externalBaseUrl}${pollPath}`;

    const apiKey = process.env.ORTHO_IMAGE_TO_3D_API_KEY;
    const apiKeyHeader = process.env.ORTHO_IMAGE_TO_3D_API_KEY_HEADER ?? 'Authorization';
    const apiKeyPrefix = process.env.ORTHO_IMAGE_TO_3D_API_KEY_PREFIX ?? 'Bearer ';
    const headers: Record<string, string> = {};
    if (apiKey) headers[apiKeyHeader] = `${apiKeyPrefix}${apiKey}`;

    // Default to GET for polling. If the provider requires POST, change ORTHO_IMAGE_TO_3D_POLL_METHOD.
    const pollMethod = process.env.ORTHO_IMAGE_TO_3D_POLL_METHOD ?? 'GET';
    const res = await fetch(url, { method: pollMethod, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new InternalServerErrorException(`Image→3D poll failed (${res.status}): ${text}`);
    }
    const payload = (await res.json()) as any;

    const externalResultUrl =
      payload?.glb_url ??
      payload?.glbUrl ??
      payload?.result_url ??
      payload?.resultUrl ??
      payload?.output?.glb_url ??
      payload?.output?.result_url ??
      payload?.output?.glbUrl;

    return {
      status: payload?.status ?? payload?.state ?? payload?.phase,
      state: payload?.state,
      externalResultUrl: typeof externalResultUrl === 'string' ? externalResultUrl : undefined,
      externalError: payload?.error ?? payload?.message ?? undefined,
    };
  }
}

