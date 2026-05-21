import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
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
    return this.http
      .get<RelapseAlert>(`${API_BASE_URL}/api/relapse/patients/${patientId}/risk`)
      .pipe(catchError(() => of(this.emptyAlert(patientId))));
  }

  getRiskTrend$(patientId: string): Observable<RelapseAlert[]> {
    return this.http
      .get<RelapseAlert[]>(`${API_BASE_URL}/api/relapse/patients/${patientId}/trend`)
      .pipe(catchError(() => of([])));
  }

  acknowledgeAlert$(alertId: string): Observable<RelapseAlert> {
    if (alertId.startsWith('pending-')) {
      return of({
        id: alertId,
        patientId: alertId.replace(/^pending-/, ''),
        riskScore: 0,
        riskLevel: 'UNKNOWN',
        factors: [],
        actions: [],
        acknowledged: true,
        createdAt: new Date().toISOString(),
      });
    }
    return this.http
      .put<RelapseAlert>(`${API_BASE_URL}/api/relapse/alerts/${alertId}/acknowledge`, {})
      .pipe(
        catchError(() =>
          of({
            id: alertId,
            patientId: '',
            riskScore: 0,
            riskLevel: 'UNKNOWN',
            factors: [],
            actions: [],
            acknowledged: true,
            createdAt: new Date().toISOString(),
          }),
        ),
      );
  }

  private emptyAlert(patientId: string): RelapseAlert {
    return {
      id: `pending-${patientId}`,
      patientId,
      riskScore: 0,
      riskLevel: 'UNKNOWN',
      factors: [],
      actions: ['Ejecutar evaluación de riesgo (J48 / Medical AI)'],
      acknowledged: false,
      createdAt: new Date().toISOString(),
    };
  }
}
