import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OdontogramService } from '../odontogram/odontogram.service';
import { TenantContext } from '../tenancy/tenancy.interceptor';

type ReconstructResponse = {
  status: string;
  data: Array<{
    id?: string;
    fdi?: string;
    pos_3d?: { x: number; y: number; z: number };
    rotation?: { x?: number; y?: number; z?: number };
    dimensions?: { w?: number; h?: number; d?: number };
  }>;
};

const UPPER_FDI = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_FDI = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

@Injectable()
export class OrthoXrayService {
  private readonly orthoBaseUrl: string;

  constructor(
    config: ConfigService,
    private readonly odontogram: OdontogramService,
  ) {
    this.orthoBaseUrl = config.get<string>('ORTHO_AI_URL') ?? 'http://ortho-ai:8000';
  }

  async reconstructAndPersist(patientId: string, image: any, tenant: TenantContext) {
    const reconstructed = await this.callReconstruct(image);
    const poses = this.toToothPoses(reconstructed?.data ?? []);
    const simulation = {
      plannedDurationMonths: 18,
      notes: 'Reconstrucción paramétrica (radiografía) v1',
      keyframes: [
        { t: 0, toothPoses: poses },
        { t: 1, toothPoses: poses },
      ],
    };

    // Persist into odontogram document so the UI can load it.
    await this.odontogram.patch(patientId, { simulation }, tenant);
    return simulation;
  }

  private async callReconstruct(image: any): Promise<ReconstructResponse> {
    const url = `${this.orthoBaseUrl}/api/reconstruct`;
    const fd = new FormData();
    fd.append('file', new Blob([image.buffer]), image.originalname);
    const res = await fetch(url, { method: 'POST', body: fd });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`ortho-ai reconstruct failed (${res.status}): ${text}`);
    }
    return (await res.json()) as ReconstructResponse;
  }

  private toToothPoses(raw: ReconstructResponse['data']): Record<string, any> {
    if (!Array.isArray(raw) || raw.length === 0) return {};

    // Split upper/lower using median y
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
          return [
            fdi,
            {
              rotX: Number(r.x ?? 0),
              rotY: Number(r.y ?? 0),
              rotZ: Number(r.z ?? 0),
              offsetMmX: Number(p.x ?? 0),
              offsetMmY: Number(p.y ?? 0),
              offsetMmZ: Number(p.z ?? 0),
            },
          ];
        }),
      );
    };

    return {
      ...mapRow(upper, UPPER_FDI),
      ...mapRow(lower, LOWER_FDI),
    };
  }
}

