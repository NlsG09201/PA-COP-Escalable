import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface J48PredictionVm {
  id: string;
  patientId: string;
  classLabel: string;
  probabilities: Record<string, number>;
  features: Record<string, unknown>;
  scoredAt: string;
}

export interface J48HistoryPointVm {
  id: string;
  classLabel: string;
  probabilities: Record<string, number>;
  features: Record<string, unknown>;
  scoredAt: string;
  riskScore: number;
}

@Injectable({ providedIn: 'root' })
export class J48ApiService {
  constructor(private readonly http: HttpClient) {}

  scorePatient$(patientId: string): Observable<{ ok: boolean; prediction: J48PredictionVm | null }> {
    return this.http.post<{ ok: boolean; prediction: J48PredictionVm | null }>(
      `${API_BASE_URL}/api/j48/score/patient`,
      { patientId },
    );
  }

  latest$(patientId: string): Observable<J48PredictionVm | null> {
    return this.http.get<J48PredictionVm | null>(`${API_BASE_URL}/api/j48/patients/${patientId}/latest`);
  }

  history$(patientId: string, limit = 24): Observable<J48HistoryPointVm[]> {
    return this.http.get<J48HistoryPointVm[]>(`${API_BASE_URL}/api/j48/patients/${patientId}/history`, {
      params: { limit: String(limit) },
    });
  }
}
