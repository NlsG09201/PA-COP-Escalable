import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface Recommendation {
  text: string;
  confidence: number;
  evidenceSources: string[];
}

export interface ClinicalDecision {
  id: string;
  patientId: string;
  decisionType: string;
  context: string;
  recommendations: Recommendation[];
  selectedRecommendation?: string;
  status: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface DecisionSiteStats {
  totalDecisions: number;
  acceptanceRate: number;
  avgConfidence: number;
  decisionsByType: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class DecisionsApiService {
  constructor(private readonly http: HttpClient) {}

  generateRecommendation$(patientId: string, decisionType: string, context: string): Observable<ClinicalDecision> {
    return this.http.post<ClinicalDecision>(`${API_BASE_URL}/api/decisions/patients/${patientId}/recommend`, {
      decisionType,
      context
    });
  }

  acceptDecision$(decisionId: string): Observable<ClinicalDecision> {
    return this.http.post<ClinicalDecision>(`${API_BASE_URL}/api/decisions/${decisionId}/accept`, {});
  }

  getDecisions$(patientId: string): Observable<ClinicalDecision[]> {
    return this.http.get<ClinicalDecision[]>(`${API_BASE_URL}/api/decisions/patients/${patientId}`);
  }

  getSiteStats$(): Observable<DecisionSiteStats> {
    return this.http.get<DecisionSiteStats>(`${API_BASE_URL}/api/decisions/stats`);
  }
}
