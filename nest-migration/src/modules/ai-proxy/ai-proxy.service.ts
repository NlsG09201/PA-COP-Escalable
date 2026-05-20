import { Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class AiProxyService {
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
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
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
    return this.forward(`${base}/model/tree`);
  }
}
