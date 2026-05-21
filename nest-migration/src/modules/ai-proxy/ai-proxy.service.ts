import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ARFF_DATASET_SCHEMA } from '../weka-lab/j48-arff-predict.util';

@Injectable()
export class AiProxyService {
  private readonly logger = new Logger(AiProxyService.name);

  private base(service: string): string {
    const map: Record<string, string> = {
      diagnosis: process.env.AI_DIAGNOSIS_URL ?? 'http://ai-diagnosis-service:8090',
      emotion: process.env.AI_EMOTION_URL ?? 'http://emotion-analysis-service:8091',
      relapse: process.env.AI_RELAPSE_URL ?? 'http://recommendation-engine:8092',
      j48: process.env.J48_URL ?? 'http://j48-python:8080',
    };
    return map[service] ?? '';
  }

  private async forward(url: string, init?: RequestInit) {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(12_000),
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      });
    } catch (err) {
      throw new ServiceUnavailableException(`AI upstream unreachable: ${(err as Error).message}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ServiceUnavailableException(`AI upstream error (${res.status}): ${text.slice(0, 500)}`);
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) return res.json();
    return res.text();
  }

  async diagnosisResults(patientId: string) {
    const base = this.base('diagnosis');
    return this.forward(`${base}/api/diagnosis/patients/${encodeURIComponent(patientId)}/results`);
  }

  async emotionResults(patientId: string) {
    const base = this.base('emotion');
    return this.forward(`${base}/api/emotion/patients/${encodeURIComponent(patientId)}/results`);
  }

  async relapseRisk(patientId: string) {
    const base = this.base('relapse');
    return this.forward(`${base}/api/relapse/patient/${encodeURIComponent(patientId)}/risk`);
  }

  async relapseTrend(patientId: string) {
    const base = this.base('relapse');
    return this.forward(`${base}/api/relapse/patient/${encodeURIComponent(patientId)}/trend`);
  }

  async therapyModules() {
    const base = this.base('relapse');
    return this.forward(`${base}/api/recommendations/clinical`, {
      method: 'POST',
      body: JSON.stringify({ specialty: 'psychology', context: 'therapy_modules' }),
    });
  }

  async j48Tree() {
    const base = this.base('j48');
    try {
      return await this.forward(`${base}/model/tree`);
    } catch (err) {
      this.logger.warn(`j48Tree offline: ${(err as Error).message}`);
      return {
        name: ARFF_DATASET_SCHEMA.displayName,
        engine: 'builtin-arff',
        offline: true,
        classes: [...ARFF_DATASET_SCHEMA.classLabels],
        features: ARFF_DATASET_SCHEMA.features.map((f) => f.key),
        root: {
          attribute: ARFF_DATASET_SCHEMA.target,
          label: 'risk_level',
          children: ARFF_DATASET_SCHEMA.classLabels.map((c) => ({ label: c, count: 0 })),
        },
      };
    }
  }
}
