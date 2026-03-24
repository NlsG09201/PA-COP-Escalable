import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

const API_BASE_URL = environment.apiBaseUrl || '';

export interface PsychologicalSnapshotVm {
  id: string;
  patientId: string;
  occurredAt: string;
  metrics: Record<string, number>;
  predominantSentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentimentScore: number;
  highRiskAlert: boolean;
  riskDetails: string;
  source: string;
}

@Injectable({ providedIn: 'root' })
export class PsychologyApiService {
  constructor(private readonly http: HttpClient) {}

  getPatientEvolution$(patientId: string): Observable<PsychologicalSnapshotVm[]> {
    return this.http.get<PsychologicalSnapshotVm[]>(`${API_BASE_URL}/api/psychology/patients/${patientId}/evolution`);
  }
}
