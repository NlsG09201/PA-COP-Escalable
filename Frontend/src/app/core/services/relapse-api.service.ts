import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface RiskFactor {
  factor: string;
  weight: number;
  description: string;
}

export interface RelapseAlert {
  id: string;
  patientId: string;
  riskScore: number;
  riskLevel: string;
  factors: RiskFactor[];
  actions: string[];
  acknowledged: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class RelapseApiService {
  constructor(private readonly http: HttpClient) {}

  assessRisk$(patientId: string): Observable<RelapseAlert> {
    return this.http.post<RelapseAlert>(`${API_BASE_URL}/api/relapse/patients/${patientId}/assess`, {});
  }

  getLatestRisk$(patientId: string): Observable<RelapseAlert> {
    // Backend endpoint is /patients/{patientId}/risk
    return this.http.get<RelapseAlert>(`${API_BASE_URL}/api/relapse/patients/${patientId}/risk`);
  }

  getRiskTrend$(patientId: string): Observable<RelapseAlert[]> {
    return this.http.get<RelapseAlert[]>(`${API_BASE_URL}/api/relapse/patients/${patientId}/trend`);
  }

  acknowledgeAlert$(alertId: string): Observable<RelapseAlert> {
    // Backend uses PUT for acknowledge.
    return this.http.put<RelapseAlert>(`${API_BASE_URL}/api/relapse/alerts/${alertId}/acknowledge`, {});
  }
}
